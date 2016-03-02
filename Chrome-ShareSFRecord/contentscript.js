/**
 * Main content script to communicate with background page and add functionality
 *
 * @type       JS library
 * @author     Kaushik Ray (kr.ray.kaushik@gmail.com)
 */
var client = new forcetk.Client();
var prefixToName = {};
var recordId = '';
var fieldsArray = new Array();

createDOMShareButton();

/**
 * This will create a new button on detail page
 * Uses bDetailBlock class to appemnd the button
 * Also registers the button click event
 *
 * @method     createDOMShareButton
 */
function createDOMShareButton() {
    $('.bDetailBlock').append(
        '<input type="button" class="btn" id="shareButton" value="Share"/>'
    );

    $(document).on("click", "#shareButton", function(){
      alert('Sharing of this record will open in a new tab to send email');
      initiateShareProcess();
    });
}

/**
 * Share button click witll call this method to initiate the process
 *
 * @method     initiateShareProcess
 */
function initiateShareProcess() {
    setSessionInstance();
}

/**
 * sets the session id by getting it from cookies and setting it to forcetk
 * all methods are sync so need to perform method chaining for same
 *
 * @method     setSessionInstance
 */
function setSessionInstance() {
    chrome.runtime.sendMessage({type: "getSessionId"}, function(response) {
        client.setSessionToken(response.sessionId);
        getAllObjectPrefix();
    });
}

/**
 * make describe callout using forcetk to get all object prefix map
 * this will help us in identifying the object on which we need to do the query
 *
 * @method     getAllObjectPrefix
 */
function getAllObjectPrefix() {
    prefixToName = {};
    client.describeGlobal(function(response){
        for (var i = 0; i < response.sobjects.length; i++) {
            var sobject = response.sobjects[i];
            if (sobject.keyPrefix) {
                prefixToName[sobject.keyPrefix] = sobject.name;
            }
        }
        getCurrentTaburl();
    });
}

/**
 * Content script method to get current tab url
 * Record id will be extracted from same
 *
 * @method     getCurrentTaburl
 */
function getCurrentTaburl() {
    chrome.runtime.sendMessage({type: "getCurrentTaburl"}, function(response) {
      recordId = getIdFromURL(response.currentTaburl);

      formQueryBasedOnRecordId(recordId);

    });
}

/**
 * Based on url passed parse the record id
 *
 * @method     getIdFromURL
 * @param      {<type>}          currentTaburl
 * @return     {string}  { actual record id }
 * @todo       Still need to make it better or get a better way to analyze identify record id
 */
function getIdFromURL(currentTaburl) {
    var spl = new Array();
    spl = currentTaburl.split('/');
    var recordId = '';
    if (spl.length > 0) {
        recordId = spl.pop();
        if (recordId.length != 15 && recordId.length != 18 && recordId.indexOf(".") != -1) {
            recordId = '';
        }
    }

    return recordId;
}

/**
 * highest leve method to start creation of query based on record id
 *
 * @method     formQueryBasedOnRecordId
 * @param      {string}  recordId  { description }
 */
function formQueryBasedOnRecordId(recordId) {
    var objectName = prefixToName[recordId.substring(0,3)];
    getAllFieldsForObject(objectName);
}

/**
 * query needs to perform with all fields, make describe callout on the object to create all fields array
 *
 * @method     getAllFieldsForObject
 * @param      {string}  objectName  { description }
 */
function getAllFieldsForObject(objectName) {
    fieldsArray = new Array();
    client.describe(objectName, function(response){
        for (var i = 0; i < response.fields.length; i++) {
            var fieldMetaData = response.fields[i];
            if (fieldMetaData.name) {
                fieldsArray.push(fieldMetaData.name);
            }
        }
        formActualQuery(objectName);
    });
}

/**
 * actual query formation
 *
 * @method     formActualQuery
 * @param      {string}  objectName  { description }
 */
function formActualQuery(objectName) {
    var queryString = 'SELECT ';
    for (var i = 0; i < fieldsArray.length; i++) {
        if (i == fieldsArray.length - 1) {
            queryString = queryString + fieldsArray[i];
        } else {
            queryString = queryString + fieldsArray[i] + ',';
        }
    }
    queryString = queryString + ' FROM ' + objectName + ' WHERE Id = \'' + recordId + '\'';
    queryDatabase(queryString);
}

/**
 * actual query will be performed here using forcetk global client
 *
 * @method     queryDatabase
 * @param      {<type>}  queryString  { description }
 */
function queryDatabase(queryString) {
    // var queryToExecute = formQuery(currentTaburl);
    // TODO - get actual id from url above and query
    client.query(queryString, function(response){
        var validRecordData = response.records[0];
        sendEmail(validRecordData);
    });

}

/**
 * email send functionality
 *
 * @method     sendEmail
 * @param      {string}  validRecordData  { description }
 */
function sendEmail(validRecordData) {
    var emailSubject = 'Data Details for record with id ' + recordId;
    var emailBody = 'Details - %0D';

    for (var property in validRecordData) {
        if (property != 'attributes') {
            if (validRecordData[property] != null) {
                emailBody = emailBody + property + ':' + validRecordData[property] + '%0D';
            }
        }
    }
    if (emailBody.length > 2000) {
        emailBody = emailBody.substring(0,2000);
    }
    window.open('mailto:?subject=' + emailSubject + '&body=' + emailBody);
}