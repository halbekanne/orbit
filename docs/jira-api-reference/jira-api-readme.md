# Jira Data Center / / Modules

## Getting started

If you haven't integrated with Jira Data Center before, read the [Getting started guide](https://developer.atlassian.com/display/JIRADEV/Getting+started+with+Plugins2) in the [Jira Data Center developer documentation](https://developer.atlassian.com/server/jira/platform/getting-started/). You may also want to read our Jira REST API overview, which describes how the Jira REST APIs work, including a simple example of a REST call.

## Previous versions

In the versions before Jira 10.0, the REST APIs of Jira Core and Jira Software were published independently. The documentation of previous versions of REST APIs is available at:

[Jira Core 9.17](https://docs.atlassian.com/software/jira/docs/api/REST/9.17.0/) | [Jira Software 9.17](https://docs.atlassian.com/jira-software/REST/9.17.0/)

[Jira Core 9.12](https://docs.atlassian.com/software/jira/docs/api/REST/9.12.0/) | [Jira Software 9.12](https://docs.atlassian.com/jira-software/REST/9.12.0/)

## Authentication

The following authentication methods are supported for the Jira REST APIs:

*   Recommended:
  *   [OAuth 2.0](https://confluence.atlassian.com/adminjiraserver/jira-oauth-2-0-provider-api-1115659070.html) - This method provides APIs to allow external services to access resources on a user's behalf with the OAuth 2.0 protocol. This protocol is not compatible with Oauth 1.0a.
  *   [Personal access token (PAT)](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html) - This method incorporates the user account in the access token. It is a safe alternative to using username and password for authentication with various services.
*   Other:
  *   [OAuth 1.0a](https://developer.atlassian.com/display/JIRADEV/JIRA+REST+API+Example+-+OAuth+authentication) - This method provides APIs to allow external services to access resources on a user's behalf with the OAuth 1.0 protocol. This protocol is deprecated.
  *   [Basic HTTP](https://developer.atlassian.com/display/JIRADEV/JIRA+REST+API+Example+-+Basic+Authentication) - This method is only recommended for tools like scripts or bots. It is easier to implement but much less secure.

Jira uses cookie-based authentication in the browser, so you can call the REST API from Javascript on the page and rely on the authentication the browser has established. To reproduce the behavior of the Jira log-in page, you can POST to the /auth/1/session resource. You can use it, for example, to display authentication error messages to users.

## URI Structure

Jira REST APIs provide access to resources (data entities) via URI paths. To use a REST API, your application will make an HTTP request and parse the response. The Jira REST API uses [JSON](http://en.wikipedia.org/wiki/JSON) as its communication format, and the standard HTTP methods like `GET`, `PUT`, `POST` and `DELETE` (see API descriptions below for which methods are available for each resource). URIs for Jira's REST API resource have the following structure:

1
2

```
http://host:port/context/rest/api-name/api-version/resource-name
```

Currently there are three API names available, which will be discussed further below. Each of those names are versioned independently. The available API names are

*   `auth` - for authentication-related operations. Current version is `1`.
*   `agile` - for agile boards and sprints. Current version is `1`.
*   `api` - for everything else. Current version is `2`.

There is also a symbolic version, called `latest`, which resolves to the latest version supported by the given Jira instance. As an example, if you wanted to retrieve the JSON representation of issue [JRA-9](https://jira.atlassian.com/browse/JRA-9) from Atlassian's public issue tracker, you would access:

1
2

```
https://jira.atlassian.com/rest/api/latest/issue/JRA-9
```

## Expansion

In order to simplify API responses, the Jira REST API uses resource expansion. This means the API will only return parts of the resource when explicitly requested.

You can use the `expand` query parameter to specify a comma-separated list of entities that you want expanded, identifying each of them by name. For example, appending `?expand=names,renderedFields` to an issue's URI requests the inclusion of the translated field names and the HTML-rendered field values in the response. Continuing with our example above, we would use the following URL to get that information for JRA-9:

1
2

```
https://jira.atlassian.com/rest/api/latest/issue/JRA-9?expand=names,renderedFields
```

To discover the identifiers for each entity, look at the `expand` property in the parent object. In the JSON example below, the resource declares widgets as being expandable.

1
2

```
{
    "expand": "widgets",
    "self": "http://www.example.com/jira/rest/api/resource/KEY-1",
    "widgets": {
        "widgets": [],
        "size": 5
    }
}
```

You can use the dot notation to specify expansion of entities within another entity. For example `?expand=widgets.fringels` would expand the widgets collection and also the fringel property on each widget.

## Pagination

Jira uses pagination to limit the response size for resources that return a potentially large collection of items. A request to a paged API will result in a values array wrapped in a JSON object with some paging metadata, for example:

#### Request

1
2

```
http://host:port/context/rest/api-name/api-version/resource-name?startAt=0&maxResults=10
```

#### Response

1
2

```
{
    "startAt" : 0,
    "maxResults" : 10,
    "total": 200,
    "values": \[
        { /\* result 0 \*/ },
        { /\* result 1 \*/ },
        { /\* result 2 \*/ }
    \]
}
```

*   `startAt` - the item used as the first item in the page of results.
*   `maxResults` - how many results to return per page.
*   `total` - the number of items that the calling user has permissions for. This number _may change_ while the client requests the next pages. A client should always assume that the requested page can be empty. REST API consumers should also consider the field to be optional. This value may not be included in the response, if it is too expensive to calculate.

Clients can use the `startAt`, `maxResults`, and `total` parameters to retrieve the desired number of results. Note, each API resource or method may have a different limit on the number of items returned, which means you can ask for more than you are given. The actual number of items returned is an implementation detail and this can be changed over time.

## Ordering

Some resources support ordering by a specific field. Ordering request is provided in the **orderBy** query parameter. See the docs for specific methods to see which fields they support and if they support ordering at all.

Ordering can be ascending or descending. By default it's ascending. To specify the ordering use "-" or "+" sign. Examples:

**?orderBy=name**

Order by "name" ascending

**?orderBy=+name**

Order by "name" ascending

**?orderBy=-name**

Order by "name" descending

## Self links

Many fields have a `self` link that takes you to the canonical location for that resource. For example:

1
2

```
"reporter": {
    "self": "http://jira.atlassian.com/rest/api/2/user?username=admin",
    "name": "admin",
    "emailAddress": "admin@example.com",
    "displayName": "Administrator",
    "active": true
},
```

Making a GET request to the `self` link can sometimes provide you with additional information about the field. For example, if we make a GET request for the `self` link for the `reporter` field above, the response will contain additional information about the user, including the timezone and groups.

## Experimental methods

Methods marked as experimental may change without an earlier notice. We are looking for your feedback for these methods.

## Special request and response headers

*   **X-AUSERNAME** - Response header which contains either username of the authenticated user or 'anonymous'.
*   **X-Atlassian-Token** - methods which accept multipart/form-data will only process requests with 'X-Atlassian-Token: no-check' header.

## Error responses

Most resources will return a response body in addition to the status code. Usually, the JSON schema of the entity returned is the following:

1
2

```
{
    "id": "https://docs.atlassian.com/jira/REST/schema/error-collection#",
    "title": "Error Collection",
    "type": "object",
    "properties": {
        "errorMessages": {
            "type": "array",
            "items": {
                "type": "string"
            }
        },
        "errors": {
            "type": "object",
            "patternProperties": {
                ".+": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "status": {
            "type": "integer"
        }
    },
    "additionalProperties": false
}
```

## Field input formats

**Summary**: A system field that is a single line of text.

1
2

```
"summary": "This is an example summary"
```

**Description**: A system field that is multiple lines of text.

1
2

```
"description": "This is an example description with multiples lines of text\n separated by\n line feeds"
```

**Components**: A system field that is multiple values addressed by 'name'.

1
2

```
"components" : [ { "name": "Active Directory"} , { "name": "Network Switch" } ]
```

**Due date**: A system field that is a date in 'YYYY-MM-DD' format.

1
2

```
"duedate" : "2015-11-18"
```

**Labels**: A system field that is an array of string values.

1
2

```
"labels" : ["examplelabelnumber1", "examplelabelnumber2"]
```

**Checkbox custom field**: A custom field that allows you to select a multiple values from a defined list of values. You can address them by `value` or by `ID`.

1
2

```
"customfield_11440" : [{ "value" : "option1"}, {"value" : "option2"}]
```

or

1
2

```
"customfield_11440" : [{ "id" : 10112}, {"id" : 10115}]
```

**Date picker custom field**: A custom field that is a date in `YYYY-MM-DD` format.

1
2

```
"customfield_11441" : "2015-11-18"
```

**Date time picker custom field**: A custom field that is a date time in ISO 8601 `YYYY-MM-DDThh:mm:ss.sTZD` format.

1
2

```
"customfield_11442" : "2015-11-18T14:39:00.000+1100"
```

**Labels custom field**: A custom field that is an array of strings.

1
2

```
"customfield_11443" : [ "rest_label1", "rest_label2" ]
```

**Number custom field**: A custom field that contains a number.

1
2

```
"customfield_11444" : 123
```

**Radio button custom field**: A custom field that allows you to select a single value from a defined list of values. You can address them by `value` or by `ID`.

1
2

```
"customfield_11445" : { "value": "option2" }
```

or

1
2

```
"customfield_11445" : { "id": 10112 }
```

**Cascading select custom field**: A custom field that allows you to select a single parent value and then a related child value. You can address them by `value` or by `ID`.

1
2

```
"customfield_11447" : { "value": "parent_option1", "child": { "value" : "p1_child1"} }
```

or

1
2

```
"customfield_11447" : { "id": 10112, "child": { "id" : 10115 } }
```

**Multi-select custom field**: A custom field that allows you to select a multiple values from a defined list of values. You can address them by `value` or by `ID`.

1
2

```
"customfield_11448" : [ { "value": "option1" }, { "value": "option2" } ]
```

or

1
2

```
"customfield_11448" : [ { "id": 10112 }, { "id": 10115 } ]
```

**Single-select custom field**: A custom field that allows you to select a single value from a defined list of values. You can address them by `value` or by `ID`.

1
2

```
"customfield_11449" : { "value": "option3" }
```

or

1
2

```
"customfield_11449" : { "id": 10112 }
```

**Multi-line text custom field**: A custom field that allows multiple lines of text.

1
2

```
"customfield_11450": "An example of multiples lines of text\n separated by\n line feeds"
```

**Text custom field**: A custom field that allows a single line of text.

1
2

```
"customfield_11450": "An example of a single line of text"
```

**URL custom field**: A custom field that allows a URL to be entered.

1
2

```
"customfield_11452" : "http://www.atlassian.com"
```

**Single-user picker custom field**: A custom field that allows a single user to be selected.

1
2

```
"customfield_11453" : { "name":"tommytomtomahawk" }
```

**Multi-user picker custom field**: A custom field that allows multiple users to be selected.

1
2

```
"customfield_11458" : [ { "name":"inigomontoya" }, { "name":"tommytomtomahawk" }]
```

## Examples

The [Jira REST API examples](/server/jira/platform/jira-rest-api-examples) guide contains a range of examples, including examples of requests for creating issues, updating issues, searching for issues, and more.

We've also provided a simple example below to get you started. The example shows you how to create an issue using the Jira REST API. The sample code uses [curl](https://curl.haxx.se) to make requests, but you can use any tool you prefer.

Note:

*   The input file is denoted by the `--data @filename` syntax. The data is shown separately, and uses the JSON format.
*   Make sure the content type in the request is set to `application/json`, as shown in the example.
*   POST the JSON to your Jira server. In the example, the server is `http://localhost:8080/jira/rest/api/2/issue/`.
*   The example uses basic authentication with admin/admin credentials.
*   You'll need to add a project to the instance before running and get the project ID of the project to which you want to add the issue beforehand.

To create an issue using the Jira REST API, follow these steps:

1.  Create the data file that contains the POST data. For this example, we'll assume the file is named `data.txt`.

2.  Add the following JSON to the file:

    1
    2

    ```
    {
        "fields": {
           "project":
           {
              "id": "10000"
           },
           "summary": "No REST for the Wicked.",
           "description": "Creating of an issue using ids for projects and issue types using the REST API",
           "issuetype": {
              "id": "3"
           }
       }
    }
    ```

    In this data, the project ID is 10000 and the issue type in our case is 3, which represents a task. You should pick an ID of a project in your instance and whichever issue type you prefer.

    Note that instead of the `id` you can also use the key and name for the `project` and `issuetype` respectively. For example,`"key": "TEST"` for the project and `"name": "Task"` for the `issuetype`.

3.  In Terminal window, run the following command:

    1
    2

    ```
    curl -u admin:admin -X POST --data @data.txt -H "Content-Type: application/json" http://localhost:8080/jira/rest/api/2/issue/
    ```

    As before, adjust details for your environment, such as the hostname or port of the Jira instance. Note that a cloud instance or most public instances would require the use of HTTPS and, of course, valid credentials for the instance.

4.  When your issue is created, check the response that will look something like this:

    1
    2

    ```
    {
       "id":"10009",
       "key":"TEST-10",
        "self":"http://localhost:8080/jira/rest/api/2/issue/10009"
    }
    ```

    That's it! You can use the issue ID, issue key, and the URL to the issue for additional requests, if you wish.


To get an issue you just created, use `http://localhost:8080/jira/rest/api/2/issue/{issueIdOrKey}` endpoint:

1
2

```
curl -u admin:admin http://localhost:8080/jira/rest/api/2/issue/TEST-10 | python -mjson.tool
```

We use `python -mjson.tool` to pretty print json.

## Field input formats

Webhooks are user-defined callbacks over HTTP that are specific to the Jira REST API. Jira webhooks allow the Jira REST API to inform a remote application when changes have occurred, for example, an issue transition. This saves the application from having to periodically poll Jira (via the REST API). To learn more, read the [Webhooks](/server/jira/platform/webhooks) page.
