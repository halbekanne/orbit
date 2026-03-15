# Bitbucket Data Center / Reference / REST API

## About

The Bitbucket Data Center and Server REST API enables you to interact with Bitbucket programmatically. This page documents the REST resources available in Bitbucket, including the HTTP response codes and example requests and responses.

General information about using the REST APIs can be found at [Using the REST API](/server/bitbucket/how-tos/command-line-rest/) and [Authenticating with the REST API](/server/bitbucket/how-tos/example-basic-authentication/).

## Intro

This is the reference document for the Bitbucket Data Center REST API. The REST API is for developers who want to:

*   integrate &product\_name; with other applications;
*   create scripts that interact with Bitbucket Data Center or
*   develop plugins that enhance the Bitbucket Data Center UI, using REST to interact with the backend.

You can read more about developing Bitbucket Data Center plugins in the [Developer Documentation](https://developer.atlassian.com/server/bitbucket/)

## Getting started

Because the REST API is based on open standards, you can use any web development language or command line tool capable of generating an HTTP request to access the API.

If you're already working with the [Atlassian SDK](https://developer.atlassian.com/server/framework/atlassian-sdk/), the [REST API Browser](https://developer.atlassian.com/server/framework/atlassian-sdk/using-the-rest-api-browser) is a great tool for exploring and experimenting with the &product\_name; REST API.

## Structure of the REST URIs

Bitbucket Data Center's REST APIs provide access to resources (data entities) via URI paths. To use a REST API, your application will make an HTTP request and parse the response. The Bitbucket Data Center REST API uses JSON as its communication format, and the standard HTTP(S) methods like GET, PUT, POST and DELETE. URIs for Bitbucket Data Center's REST API resource have the following structure:

`http://host:port/context/rest/api-name/api-version/path/to/resource`

For example, the following URI would retrieve a page of the latest commits to the _jira_ repository in the _Jira_ project on `https://bitbucket.example.com`

Copy

`1`
`https://bitbucket.example.com/rest/api/1.0/projects/JIRA/repos/jira/commits`

See the API descriptions on the left for a full list of available resources.

Alternatively we also publish a list of resources in [https://en.wikipedia.org/wiki/OpenAPI\_Specification](OpenAPI) format. It is available via the triple dot menu above.

## Paged APIs

Bitbucket Data Center uses paging to conserve server resources and limit response size for resources that return potentially large collections of items. A request to a paged API will result in a `values` array wrapped in a JSON object with some paging metadata, like this:

1
2

```
{
    "size": 3,
    "limit": 3,
    "isLastPage": false,
    "values": [
        {
            /* result 0 */
        },
        {
            /* result 1 */
        },
        {
            /* result 2 */
        }
    ],
    "start": 0,
    "filter": null,
    "nextPageStart": 3
}
```

Clients can use the `limit` and `start` query parameters to retrieve the desired number of results.

The `limit` parameter indicates how many results to return per page. Most APIs default to returning `25` if the limit is left unspecified. This number can be increased, but note that a resource-specific hard limit will apply. These hard limits can be configured by server administrators, so it's always best practice to check the `limit` attribute on the response to see what limit has been applied. The request to get a larger page should look like this:

1
2

```
http://host:port/context/rest/api-name/api-version/path/to/resource?limit={desired size of page}
```

For example:

1
2

```
    https://bitbucket.example.com/rest/api/1.0/projects/JIRA/repos/jira/commits?limit=1000
```

The `start` parameter indicates which item should be used as the first item in the page of results. All paged responses contain an `isLastPage` attribute indicating whether another page of items exists.

_Important:_ If more than one page exists (i.e. the response contains `"isLastPage": false`), the response object will also contain a `nextPageStart` attribute which __must__ be used by the client as the `start` parameter on the next request. Identifiers of adjacent objects in a page may not be contiguous, so the start of the next page is _not_ necessarily the start of the last page plus the last page's size. A client should always use `nextPageStart` to avoid unexpected results from a paged API. The request to get a subsequent page should look like this:

1
2

```
    http://host:port/context/rest/api-name/api-version/path/to/resource?start={nextPageStart from previous response}
```

For example:

1
2

```
    https://bitbucket.example.com/rest/api/1.0/projects/JIRA/repos/jira/commits?start=25
```

## Authentication

Any authentication that works against Bitbucket Data Center will work against the REST API. _The preferred authentication methods are HTTP Basic (when using SSL) and OAuth_. Other supported methods include: HTTP Cookies and HTTP Aaccess Tokens

You can find OAuth code samples in several programming languages at [bitbucket.org/atlassianlabs/atlassian-oauth-examples/](https://bitbucket.org/atlassianlabs/atlassian-oauth-examples/)

The log-in page uses cookie-based authentication, so if you are using Bitbucket Data Center in a browser you can call REST from JavaScript on the page and rely on the authentication that the browser has established.

## Errors & Validation

If a request fails due to client error, the resource will return an HTTP response code in the 40x range. These can be broadly categorised into:

| HTTP Code | Description |
| --- | --- |
| 400 (Bad Request) | One or more of the required parameters or attributes: were missing from the request; incorrectly formatted; or inappropriate in the given context. |
| 401 (Unauthorized) | Either: Authentication is required but was not attempted, or authentication was attempted but failed, or authentication was successful but the authenticated user does not have the requisite permission for the resource. See the individual resource documentation for details of required permissions. |
| 403 (Forbidden) | Actions are usually "forbidden" if they involve breaching the licensed user limit of the server, or degrading the authenticated user's permission level. See the individual resource documentation for more details. |
| 404 (Not Found) | The entity you are attempting to access, or the project or repository containing it, does not exist. |
| 405 (Method Not Allowed) | The request HTTP method is not appropriate for the targeted resource. For example an HTTP GET to a resource that only accepts an HTTP POST will result in a 405. |
| 409 (Conflict) | The attempted update failed due to some conflict with an existing resource. For example: creating a project with a key that already exists, merging an out-of-date pull request, deleting a comment that has replies, etc. |
| 415 (Unsupported Media Type) | The request entity has a `Content-Type` that the server does not support. Almost all of the Bitbucket Data Center REST API accepts `application/json` format, but check the individual resource documentation for more details. Additionally, double-check that you are setting the `Content-Type` header correctly on your request (e.g. using `-H "Content-Type: application/json"` in cURL). |

For _400_ HTTP codes the response will typically contain one or more validation error messages, for example:

See the individual resource documentation for

1
2

```
{
    "errors": [
        {
            "context": "name",
            "message": "The name should be between 1 and 255 characters.",
            "exceptionName": null
        },
        {
            "context": "email",
            "message": "The email should be a valid email address.",
            "exceptionName": null
        }
    ]
}
```

The `context` attribute indicates which parameter or request entity attribute failed validation. Note that the `context` may be null.

For _401_, _403_, _404_ and _409_ HTTP codes, the response will contain one or more descriptive error messages:

1
2

```
{
    "errors": [
        {
            "context": null,
            "message": "A detailed error message.",
            "exceptionName": null
        }
    ]
}
```

A _500_ (Server Error) HTTP code indicates an incorrect resource url or an unexpected server error. Double-check the URL you are trying to access, then report the issue to your server administrator or [Atlassian Support](https://getsupport.atlassian.com%5D) if problems persist.

## Personal Repositories

Bitbucket Data Center allows users to manage their own repositories, called personal repositories. These are repositories associated with the user and to which they always have REPO\_ADMIN permission.

Accessing personal repositories via REST is achieved through the normal project-centric REST URLs using the user's slug prefixed by tilde as the project key. E.g. to list personal repositories for a user with slug "johnsmith" you would make a GET to: `http://example.com/rest/api/1.0/projects/~johnsmith/repos`

In addition to this, Bitbucket Data Center allows access to these repositories through an alternate set of user-centric REST URLs beginning with: `http://example.com/rest/api/1.0/users/~{userSlug}/repos` E.g. to list the forks of the repository with slug "nodejs" in the personal project of user with slug "johnsmith" using the regular REST URL you would make a GET to: `http://example.com/rest/api/1.0/projects/~johnsmith/repos/nodejs/forks` Using the alternate URL, you would make a GET to: `http://example.com/rest/api/1.0/users/johnsmith/repos/nodejs/forks`

## Rolling Upgrades REST API

Provides Rolling Upgrade capabilities.

### Table of Contents

*   [Servers](#servers)
*   [Paths](#paths)
  *   [`GET` /state](#op-get-state)
  *   [`GET` /nodes/{nodeId}](#op-get-nodes-nodeid)
  *   [`GET` /cluster](#op-get-cluster)
  *   [`POST` /start](#op-post-start)
  *   [`POST` /cancel](#op-post-cancel)
  *   [`POST` /approve](#op-post-approve)
*   [Schemas](#schemas)
  *   ClusterStateResponse
  *   Link
  *   NodeInfoDTO
  *   Cluster

### Servers

| URL | Description |
| --- | --- |
| [/rest/zdu](/rest/zdu) | The ZDU REST resource for the server |

### Paths

### `GET` /state

> Gets the Cluster State

Gets the State of the Cluster and the responding Node's information.

#### Responses

##### ▶ 200 - Returns full JSON representation of cluster state

###### Headers

_No headers specified_

###### application/json

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| buildInfo | object | Represents a Cluster Node and its current state. | _Any_ |
| buildInfo.id | string | The id of the Node in cluster. | _Any_ |
| buildInfo.name | string | The name of the Node. | _Any_ |
| buildInfo.ipAddress | string | The IP address of the Node. | _Any_ |
| buildInfo.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| buildInfo.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| buildInfo.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| buildInfo.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| buildInfo.version | string | The version of the Node's installed Product. | _Any_ |
| buildInfo.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| buildInfo.portNumber | integer |     | _Any_ |
| buildInfo.links | array(object) | Hypermedia links | _Any_ |
| buildInfo.links.rel | string | rel | _Any_ |
| buildInfo.links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "state": "STABLE",
    "buildInfo": {
        "id": "string",
        "name": "string",
        "ipAddress": "string",
        "state": "STARTING",
        "tasksTotal": 0,
        "activeUserCount": 0,
        "buildNumber": "string",
        "version": "string",
        "local": true,
        "portNumber": 0,
        "links": [
            {
                "rel": "string",
                "href": "http://example.com"
            }
        ]
    }
}
```

##### ▶ 401 - Returned if user is not authenticated

###### Headers

_No headers specified_

##### ▶ 403 - Returned if the calling user does not have permission to view the content

###### Headers

_No headers specified_

#### Tags

### `GET` /nodes/{nodeId}

> Gets the Node's overview

Gets the requested Node's information.

#### Path parameters

##### ▷ nodeId

| Name | Type | In  | Description | Accepted values |
| --- | --- | --- | --- | --- |
| nodeId **(required)** | string | path |     | _Any_ |

#### Responses

##### ▶ 200 - Returns full JSON representation of the cluster node

###### Headers

_No headers specified_

###### application/json

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| id  | string | The id of the Node in cluster. | _Any_ |
| name | string | The name of the Node. | _Any_ |
| ipAddress | string | The IP address of the Node. | _Any_ |
| state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| version | string | The version of the Node's installed Product. | _Any_ |
| local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| portNumber | integer |     | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "id": "string",
    "name": "string",
    "ipAddress": "string",
    "state": "STARTING",
    "tasksTotal": 0,
    "activeUserCount": 0,
    "buildNumber": "string",
    "version": "string",
    "local": true,
    "portNumber": 0,
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```

##### ▶ 401 - Returned if user is not authenticated

###### Headers

_No headers specified_

##### ▶ 403 - Returned if the calling user does not have permission to view the content

###### Headers

_No headers specified_

##### ▶ 404 - Returned if there is no content with the given id

###### Headers

_No headers specified_

#### Tags

### `GET` /cluster

> Gets the Cluster overview

Gets an overview of a Cluster including its current state and composition of Nodes.

#### Responses

##### ▶ 200 - Returns full JSON representation of the cluster

###### Headers

_No headers specified_

###### application/json

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| upgradeModeEnabled | boolean | If true, it's safe to upgrade the nodes of the cluster | _Any_ |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| originalVersion | string | The original product version when ZDU was enabled | _Any_ |
| nodes | array(object) | The nodes which form the Cluster. | _Any_ |
| nodes.id | string | The id of the Node in cluster. | _Any_ |
| nodes.name | string | The name of the Node. | _Any_ |
| nodes.ipAddress | string | The IP address of the Node. | _Any_ |
| nodes.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| nodes.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| nodes.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| nodes.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| nodes.version | string | The version of the Node's installed Product. | _Any_ |
| nodes.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| nodes.portNumber | integer |     | _Any_ |
| nodes.links | array(object) | Hypermedia links | _Any_ |
| nodes.links.rel | string | rel | _Any_ |
| nodes.links.href | string | uri | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "upgradeModeEnabled": true,
    "state": "STABLE",
    "originalVersion": "string",
    "nodes": [
        {
            "id": "string",
            "name": "string",
            "ipAddress": "string",
            "state": "STARTING",
            "tasksTotal": 0,
            "activeUserCount": 0,
            "buildNumber": "string",
            "version": "string",
            "local": true,
            "portNumber": 0,
            "links": [
                {
                    "rel": "string",
                    "href": "http://example.com"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```

##### ▶ 401 - Returned if user is not authenticated

###### Headers

_No headers specified_

##### ▶ 403 - Returned if the calling user does not have permission to view the content

###### Headers

_No headers specified_

#### Tags

### `POST` /start

> Start ZDU upgrade

Enables Upgrading of individual Nodes within the Cluster, allowing a heterogeneous Cluster formation.

#### Responses

##### ▶ 200 - Returns full JSON representation of the cluster

###### Headers

_No headers specified_

###### application/json

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| upgradeModeEnabled | boolean | If true, it's safe to upgrade the nodes of the cluster | _Any_ |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| originalVersion | string | The original product version when ZDU was enabled | _Any_ |
| nodes | array(object) | The nodes which form the Cluster. | _Any_ |
| nodes.id | string | The id of the Node in cluster. | _Any_ |
| nodes.name | string | The name of the Node. | _Any_ |
| nodes.ipAddress | string | The IP address of the Node. | _Any_ |
| nodes.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| nodes.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| nodes.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| nodes.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| nodes.version | string | The version of the Node's installed Product. | _Any_ |
| nodes.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| nodes.portNumber | integer |     | _Any_ |
| nodes.links | array(object) | Hypermedia links | _Any_ |
| nodes.links.rel | string | rel | _Any_ |
| nodes.links.href | string | uri | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "upgradeModeEnabled": true,
    "state": "STABLE",
    "originalVersion": "string",
    "nodes": [
        {
            "id": "string",
            "name": "string",
            "ipAddress": "string",
            "state": "STARTING",
            "tasksTotal": 0,
            "activeUserCount": 0,
            "buildNumber": "string",
            "version": "string",
            "local": true,
            "portNumber": 0,
            "links": [
                {
                    "rel": "string",
                    "href": "http://example.com"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```

##### ▶ 401 - Returned if user is not authenticated

###### Headers

_No headers specified_

##### ▶ 403 - Returned if the calling user does not have permission to view the content

###### Headers

_No headers specified_

##### ▶ 409 - Returned if the cluster is not in a valid state

###### Headers

_No headers specified_

#### Tags

### `POST` /cancel

> Cancel ZDU upgrade

Prohibits the Upgrading of individual Nodes within the Cluster. All Nodes need to be on the same version before performing this request.

#### Responses

##### ▶ 200 - Returns full JSON representation of the cluster

###### Headers

_No headers specified_

###### application/json

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| upgradeModeEnabled | boolean | If true, it's safe to upgrade the nodes of the cluster | _Any_ |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| originalVersion | string | The original product version when ZDU was enabled | _Any_ |
| nodes | array(object) | The nodes which form the Cluster. | _Any_ |
| nodes.id | string | The id of the Node in cluster. | _Any_ |
| nodes.name | string | The name of the Node. | _Any_ |
| nodes.ipAddress | string | The IP address of the Node. | _Any_ |
| nodes.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| nodes.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| nodes.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| nodes.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| nodes.version | string | The version of the Node's installed Product. | _Any_ |
| nodes.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| nodes.portNumber | integer |     | _Any_ |
| nodes.links | array(object) | Hypermedia links | _Any_ |
| nodes.links.rel | string | rel | _Any_ |
| nodes.links.href | string | uri | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "upgradeModeEnabled": true,
    "state": "STABLE",
    "originalVersion": "string",
    "nodes": [
        {
            "id": "string",
            "name": "string",
            "ipAddress": "string",
            "state": "STARTING",
            "tasksTotal": 0,
            "activeUserCount": 0,
            "buildNumber": "string",
            "version": "string",
            "local": true,
            "portNumber": 0,
            "links": [
                {
                    "rel": "string",
                    "href": "http://example.com"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```

##### ▶ 401 - Returned if user is not authenticated

###### Headers

_No headers specified_

##### ▶ 403 - Returned if the calling user does not have permission to view the content

###### Headers

_No headers specified_

##### ▶ 409 - Returned if the cluster is not in a valid state

###### Headers

_No headers specified_

#### Tags

### `POST` /approve

> Approve the ZDU upgrade

Finalizes the ZDU upgrade and runs specific tasks such as cleanup scripts.

#### Responses

##### ▶ 200 - Returns full JSON representation of the cluster

###### Headers

_No headers specified_

###### application/json

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| upgradeModeEnabled | boolean | If true, it's safe to upgrade the nodes of the cluster | _Any_ |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| originalVersion | string | The original product version when ZDU was enabled | _Any_ |
| nodes | array(object) | The nodes which form the Cluster. | _Any_ |
| nodes.id | string | The id of the Node in cluster. | _Any_ |
| nodes.name | string | The name of the Node. | _Any_ |
| nodes.ipAddress | string | The IP address of the Node. | _Any_ |
| nodes.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| nodes.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| nodes.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| nodes.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| nodes.version | string | The version of the Node's installed Product. | _Any_ |
| nodes.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| nodes.portNumber | integer |     | _Any_ |
| nodes.links | array(object) | Hypermedia links | _Any_ |
| nodes.links.rel | string | rel | _Any_ |
| nodes.links.href | string | uri | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "upgradeModeEnabled": true,
    "state": "STABLE",
    "originalVersion": "string",
    "nodes": [
        {
            "id": "string",
            "name": "string",
            "ipAddress": "string",
            "state": "STARTING",
            "tasksTotal": 0,
            "activeUserCount": 0,
            "buildNumber": "string",
            "version": "string",
            "local": true,
            "portNumber": 0,
            "links": [
                {
                    "rel": "string",
                    "href": "http://example.com"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```

##### ▶ 401 - Returned if user is not authenticated

###### Headers

_No headers specified_

##### ▶ 403 - Returned if the calling user does not have permission to view the content

###### Headers

_No headers specified_

##### ▶ 409 - Returned if the cluster is not in a valid state

###### Headers

_No headers specified_

##### ▶ 500 - Internal Error

###### Headers

_No headers specified_

#### Tags

### Schemas

#### ClusterStateResponse

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| buildInfo | object | Represents a Cluster Node and its current state. | _Any_ |
| buildInfo.id | string | The id of the Node in cluster. | _Any_ |
| buildInfo.name | string | The name of the Node. | _Any_ |
| buildInfo.ipAddress | string | The IP address of the Node. | _Any_ |
| buildInfo.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| buildInfo.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| buildInfo.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| buildInfo.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| buildInfo.version | string | The version of the Node's installed Product. | _Any_ |
| buildInfo.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| buildInfo.portNumber | integer |     | _Any_ |
| buildInfo.links | array(object) | Hypermedia links | _Any_ |
| buildInfo.links.rel | string | rel | _Any_ |
| buildInfo.links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "state": "STABLE",
    "buildInfo": {
        "id": "string",
        "name": "string",
        "ipAddress": "string",
        "state": "STARTING",
        "tasksTotal": 0,
        "activeUserCount": 0,
        "buildNumber": "string",
        "version": "string",
        "local": true,
        "portNumber": 0,
        "links": [
            {
                "rel": "string",
                "href": "http://example.com"
            }
        ]
    }
}
```

#### Link

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| rel | string | rel | _Any_ |
| href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "rel": "string",
    "href": "http://example.com"
}
```

#### NodeInfoDTO

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| id  | string | The id of the Node in cluster. | _Any_ |
| name | string | The name of the Node. | _Any_ |
| ipAddress | string | The IP address of the Node. | _Any_ |
| state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| version | string | The version of the Node's installed Product. | _Any_ |
| local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| portNumber | integer |     | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "id": "string",
    "name": "string",
    "ipAddress": "string",
    "state": "STARTING",
    "tasksTotal": 0,
    "activeUserCount": 0,
    "buildNumber": "string",
    "version": "string",
    "local": true,
    "portNumber": 0,
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```

#### Cluster

| Name | Type | Description | Accepted values |
| --- | --- | --- | --- |
| upgradeModeEnabled | boolean | If true, it's safe to upgrade the nodes of the cluster | _Any_ |
| state | string | The current state of the Cluster. | `STABLE`, `READY_TO_UPGRADE`, `MIXED`, `READY_TO_RUN_UPGRADE_TASKS`, `RUNNING_UPGRADE_TASKS`, `UPGRADE_TASKS_FAILED` |
| originalVersion | string | The original product version when ZDU was enabled | _Any_ |
| nodes | array(object) | The nodes which form the Cluster. | _Any_ |
| nodes.id | string | The id of the Node in cluster. | _Any_ |
| nodes.name | string | The name of the Node. | _Any_ |
| nodes.ipAddress | string | The IP address of the Node. | _Any_ |
| nodes.state | string | The current state of the Node. | `STARTING`, `ACTIVE`, `DRAINING`, `TERMINATING`, `OFFLINE`, `ERROR` |
| nodes.tasksTotal | integer | The total number of active tasks on the Node. | _Any_ |
| nodes.activeUserCount | integer | The total number of active users on the Node. | _Any_ |
| nodes.buildNumber | string | The build number (DB schema version) of the Node's installed Product. | _Any_ |
| nodes.version | string | The version of the Node's installed Product. | _Any_ |
| nodes.local | boolean | True if this is the local node for the current session; otherwise false for remote nodes. | _Any_ |
| nodes.portNumber | integer |     | _Any_ |
| nodes.links | array(object) | Hypermedia links | _Any_ |
| nodes.links.rel | string | rel | _Any_ |
| nodes.links.href | string | uri | _Any_ |
| links | array(object) | Hypermedia links | _Any_ |
| links.rel | string | rel | _Any_ |
| links.href | string | uri | _Any_ |

##### Example _(generated)_

1
2

```
{
    "upgradeModeEnabled": true,
    "state": "STABLE",
    "originalVersion": "string",
    "nodes": [
        {
            "id": "string",
            "name": "string",
            "ipAddress": "string",
            "state": "STARTING",
            "tasksTotal": 0,
            "activeUserCount": 0,
            "buildNumber": "string",
            "version": "string",
            "local": true,
            "portNumber": 0,
            "links": [
                {
                    "rel": "string",
                    "href": "http://example.com"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "string",
            "href": "http://example.com"
        }
    ]
}
```
