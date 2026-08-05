# Perfex CRM node for n8n - Official API & Webhook Workflow Automation

[![npm version](https://img.shields.io/npm/v/@themesic/n8n-nodes-perfex-crm.svg)](https://www.npmjs.com/package/@themesic/n8n-nodes-perfex-crm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

**Connect [Perfex CRM](https://1.envato.market/mydata-crm) to n8n and automate your
customers, leads, invoices, estimates, proposals, projects, tasks and support
tickets.** This is the n8n community node published by
[Themesic Interactive](https://themesic.com), author of the
[REST API module for Perfex CRM](https://themesic.com/product/rest-api-module-for-perfex-crm-connect-your-perfex-crm-with-third-party-applications/) -
the API layer Perfex CRM automation is built on, an Envato Elite Author product
with 2,900+ sales and a 4.91/5 rating.

Perfex CRM is self-hosted and ships without a REST API. This node talks directly
to the API that our module adds to **your own** installation. No third-party
proxy, no per-operation fees, no vendor lock-in: your data goes from n8n to your
server and nowhere else.

> **In one sentence:** `@themesic/n8n-nodes-perfex-crm` lets n8n read and write
> Perfex CRM data over the REST API module, covering 23 resources with 130+
> operations plus a polling trigger.

## What's new (REST API module v3)

The module the node connects to reached **v3.0.0, the AI-ready release**. This
node now exposes the parts of v3 that matter inside n8n:

- **Knowledge Base** articles and groups, and polymorphic **Notes** you can
  attach to customers, leads, tickets, invoices and eight more entity types
- **Webhooks management** - create, list, update, delete, enable/disable and
  read delivery logs of Perfex webhooks straight from a workflow, plus a Get
  Event Catalog operation listing all 124 events
- A **list toolkit** on every Get Many / Search: sorting, field selection and
  `created_after` / `created_before` date-range filters, on top of pagination

v3 also ships things that work *through* this node without extra configuration:
an **MCP server** with 148 AI-agent tools, **Webhooks 2.0** (124 events, async
delivery with retries and HMAC signatures), an **OpenAPI 3.0** endpoint,
**batch operations**, `Idempotency-Key` support and `X-RateLimit` headers. See
[Real-time webhooks](#real-time-webhooks-for-perfex-crm) and
[AI agents](#ai-agents-mcp).

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Credentials](#credentials)
- [Supported resources and operations](#supported-resources-and-operations)
- [Trigger node](#trigger-node)
- [Real-time webhooks](#real-time-webhooks-for-perfex-crm)
- [Other automation platforms](#other-automation-platforms)
- [AI agents (MCP)](#ai-agents-mcp)
- [Example workflows](#example-workflows)
- [Behaviour notes](#behaviour-notes)
- [FAQ](#faq)
- [Related products](#related-products)

---

## Requirements

| Requirement | Details |
| --- | --- |
| Perfex CRM | Any self-hosted installation - [get Perfex CRM](https://1.envato.market/mydata-crm) |
| REST API module | [REST API module for Perfex CRM](https://codecanyon.net/item/rest-api-for-perfex-crm/25278359) v2.x or v3.x installed on that installation (v3.0.3 is current) |
| n8n | 1.x, self-hosted or Cloud |
| PHP | 7.4+ or 8.x on the Perfex server |

The REST API module is what exposes the endpoints this node calls. Without it,
Perfex CRM has no REST API to connect to.

## Installation

### n8n Cloud and self-hosted (GUI)

Settings > Community Nodes > Install, then enter:

```
@themesic/n8n-nodes-perfex-crm
```

### Self-hosted (manual)

```bash
cd ~/.n8n/nodes
npm install @themesic/n8n-nodes-perfex-crm
```

Full instructions: [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

Create an API token in Perfex CRM under **Setup > API**, then add a
**Perfex CRM API** credential in n8n:

| Field | Example | Notes |
| --- | --- | --- |
| Perfex CRM URL | `https://crm.yourcompany.com` | Your own installation, no trailing slash |
| API Token | `eyJ0eXAiOiJKV1Qi...` | Generated under Setup > API |

The token is sent as an `authtoken` header on every request. The REST API module
also supports JWT, Bearer authorization and query-parameter authentication, along
with per-token permissions, rate limiting, quota limiting and IP allow/deny lists
with CIDR notation - all configured on your server, not in n8n.

Saving the credential runs a live check against your installation, so a wrong URL
or an expired token is caught immediately.

## Supported resources and operations

23 resources, 130+ operations. Operations are available where the API supports
them.

| Resource | Create | Get | Get Many | Update | Delete | Search |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Customers | Y | Y | Y | Y | Y | Y |
| Contacts | Y | | Y | Y | Y | Y |
| Leads | Y | Y | Y | Y | Y | Y |
| Invoices | Y | Y | Y | Y | Y | Y |
| Estimates | Y | Y | Y | Y | Y | Y |
| Proposals | Y | Y | Y | Y | Y | Y |
| Credit Notes | Y | Y | Y | Y | Y | Y |
| Payments | Y | Y | Y | | | Y |
| Expenses | Y | Y | Y | Y | Y | Y |
| Items | Y | Y | Y | Y | Y | Y |
| Projects | Y | Y | Y | Y | Y | Y |
| Milestones | Y | Y | Y | Y | Y | Y |
| Tasks | Y | Y | Y | Y | Y | Y |
| Timesheets | Y | Y | Y | Y | Y | |
| Tickets | Y | Y | Y | Y | Y | Y |
| Contracts | Y | Y | Y | Y | Y | Y |
| Subscriptions | Y | Y | Y | Y | Y | |
| Staff Members | Y | Y | Y | Y | Y | Y |
| Calendar Events | Y | Y | Y | Y | Y | |
| Knowledge Base | Y | Y | Y | Y | Y | Y |
| Knowledge Base Groups | Y | | Y | Y | Y | |
| Notes | Y | Y | | Y | Y | |
| Webhooks | Y | Y | Y | Y | Y | |

**Notes** are polymorphic: create one against any of 12 entity types, and use
*List By Entity* to read all notes on a given record. **Webhooks** add
*Toggle* (enable/disable), *Get Logs* (delivery history) and *Get Event
Catalog* (all 124 event keys) beyond plain CRUD.

Every **Get Many** and **Search** accepts an **Options** field with `sort`,
`fields`, `created_after` and `created_before` (v3 list toolkit), on top of the
Return All / Limit pagination.

Custom fields are supported across modules, and the REST API module additionally
exposes dynamic custom-table endpoints, so data created by other Perfex add-ons
can be reached as well.

## Trigger node

**Perfex CRM Trigger** polls your installation on a schedule and starts a
workflow when new records appear:

- New customer
- New invoice
- New lead
- New task
- New ticket

The first poll records the current state rather than replaying history, so
connecting the trigger to an established CRM does not flood your workflow.

## Real-time webhooks for Perfex CRM

Polling is convenient, but event-driven automation is faster and cheaper. Two
webhook systems are available on the Perfex side, and both work with n8n's
built-in **Webhook** node - point them at your n8n webhook URL and you get
instant triggers.

### Events webhooks, included in the REST API module

Since v3.0 the [REST API module](https://codecanyon.net/item/rest-api-for-perfex-crm/25278359)
ships **Webhooks 2.0**: **124 events across 22 event groups**, managed entirely
over REST (`/api/webhooks`, `/api/webhooks/events`, per-webhook toggle and
delivery logs), with asynchronous delivery and SSRF protection. It includes:

- **SHA256 HMAC signature verification**, so you can prove a payload came from your CRM
- **Configurable retry logic** for failed deliveries
- **Delivery logging and a testing interface** in the admin area
- **Custom HTTP headers** per webhook

### Webhooks module, sold separately

The [Webhooks module for Perfex CRM](https://codecanyon.net/item/webhooks-module-for-perfex-crm/38350010)
covers CRM business events rather than API events, across **14 entity types**:
leads, customers, invoices including recurring, tasks, projects, estimates,
proposals, tickets, payments, staff, custom fields, contracts, calendar events
and expenses.

It fires on create, update and delete, plus lifecycle events such as **accepted,
declined and sent**, status changes, lead conversions and task timer actions. It
supports six HTTP methods, 30+ standard headers plus custom ones, delayed trigger
execution, webhook cloning, testing and filtered logs.

**Which to use:** this n8n node for reading and writing data, the trigger node for
simple polling, and the Webhooks module when a workflow must start the instant
something happens in the CRM.

## Other automation platforms

The same REST API module powers Perfex CRM automation everywhere, so you are not
tied to one tool:

| Platform | Support |
| --- | --- |
| **n8n** | This community node, plus the generic HTTP Request and Webhook nodes |
| **Zapier** | Native Perfex CRM connector |
| **Make.com** | Native app with triggers, actions and searches |
| **Pabbly Connect** | Via REST API and webhooks |
| **IFTTT** | Via webhooks |
| **Anything else** | Standard REST over HTTPS with JSON - **74 paths, 144 operations** described by an OpenAPI 3.0 spec (`GET /api/openapi`, [reference copy](https://github.com/themesic/perfex-rest-api-examples/tree/main/openapi)) plus a ready-made [Postman collection](https://github.com/themesic/perfex-rest-api-examples/tree/main/postman) |

## Example workflows

- **Lead capture:** website form > n8n > *Create a lead* in Perfex CRM
- **Invoice follow-up:** *Perfex CRM Trigger* on new invoice > Slack message and customer email
- **Accounting sync:** *Get many payments* on a schedule > push rows to Google Sheets or Xero
- **Support routing:** Webhooks module fires on new ticket > n8n Webhook node > assign, notify, escalate
- **Client onboarding:** signed contract > *Create a customer*, *Create a project*, *Create tasks* in sequence
- **AI agent:** the node is exposed as an n8n tool, so an agent can query and update the CRM directly

## Behaviour notes

Some Perfex endpoints answer `404 No data were found` instead of an empty list.
The node treats that as "no items" rather than an error, so an empty CRM or a
filter with no matches does not break a workflow.

List endpoints answer in two shapes depending on the resource - either
`{ data, meta }` with pagination metadata, or a bare array - and the node
normalises both, so downstream nodes always receive plain items.

Contacts have no global list endpoint in Perfex; **Get Many** on contacts asks for
a Customer ID and returns that customer's contacts.

Pagination is supported with a configurable page size up to 100 records.

## FAQ

**Does Perfex CRM have an API?**
Not out of the box. Perfex CRM is self-hosted and ships without a REST API. The
[REST API module for Perfex CRM](https://codecanyon.net/item/rest-api-for-perfex-crm/25278359)
adds one to your installation, and this n8n node talks to it.

**Is this node free?**
Yes, the node is MIT licensed and free. It requires the REST API module on your
Perfex installation, which is a one-time purchase on CodeCanyon.

**Do I pay per operation or per record?**
No. The module is a one-time purchase and runs on your own server. There is no
metered third-party service between n8n and your CRM.

**Can I self-host everything?**
Yes. Perfex CRM, the REST API module and n8n can all run on your own
infrastructure, which suits agencies and companies with data-residency
requirements.

**How do I get real-time triggers instead of polling?**
Use the webhook systems described above with n8n's Webhook node. See
[Real-time webhooks](#real-time-webhooks-for-perfex-crm).

**Which Perfex versions are supported?**
The REST API module supports PHP 7.4+ and 8.x and current Perfex CRM releases.
See the [product page](https://themesic.com/product/rest-api-module-for-perfex-crm-connect-your-perfex-crm-with-third-party-applications/)
for the compatibility list.

**Where is the API documentation?**
[perfexcrm.themesic.com/apiguide](https://perfexcrm.themesic.com/apiguide/) -
every endpoint with request and response examples, plus an interactive playground.

**Can I use it with an AI agent?**
Yes, two ways. Inside n8n, the node declares itself usable as a tool, so n8n AI
Agent nodes can call Perfex CRM operations directly. Outside n8n, v3.0 of the
REST API module ships a native **MCP server** (`POST /api/mcp`, JSON-RPC 2.0)
exposing **148 permission-filtered CRM tools** to Claude Desktop, Cursor and any
MCP client - see the
[MCP guide](https://github.com/themesic/perfex-rest-api-examples/blob/main/docs/mcp.md).

## Related products

| Product | What it does |
| --- | --- |
| [Perfex CRM](https://1.envato.market/mydata-crm) | The self-hosted CRM this node connects to |
| [REST API module for Perfex CRM](https://codecanyon.net/item/rest-api-for-perfex-crm/25278359) | Adds the REST API, events webhooks, Swagger playground and Postman collection. **Required for this node** |
| [Webhooks module for Perfex CRM](https://codecanyon.net/item/webhooks-module-for-perfex-crm/38350010) | Real-time webhooks for 14 CRM entity types, with lifecycle events |

## Resources

- [API documentation](https://perfexcrm.themesic.com/apiguide/)
- [Code examples, Postman collection and OpenAPI spec](https://github.com/themesic/perfex-rest-api-examples)
- [REST API module product page](https://themesic.com/product/rest-api-module-for-perfex-crm-connect-your-perfex-crm-with-third-party-applications/)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Report an issue](https://github.com/themesic/n8n-nodes-perfex-crm/issues)

## Support

Issues with the node: [GitHub issues](https://github.com/themesic/n8n-nodes-perfex-crm/issues).
Questions about the REST API module: `info@themesic.com`, or the CodeCanyon item
comments.

## Trademarks

Perfex CRM is a trademark of its respective owner. This package is published by
Themesic Interactive, author of the REST API module for Perfex CRM, and is not
affiliated with or endorsed by n8n GmbH. Product links to CodeCanyon and Envato
may be affiliate links.

## License

[MIT](LICENSE.md)

---

**Keywords:** Perfex CRM n8n integration, Perfex CRM API, Perfex CRM automation,
Perfex CRM REST API module, Perfex CRM webhooks, Perfex CRM MCP server, Perfex
CRM AI agent, Perfex CRM knowledge base, Perfex CRM notes, Perfex CRM OpenAPI,
Perfex CRM Zapier, Perfex CRM Make.com, self-hosted CRM automation, n8n community
node, n8n AI agent tool, CRM workflow automation.
