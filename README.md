# n8n-nodes-perfex-crm

An n8n community node for [Perfex CRM](https://www.perfexcrm.com/), built and
maintained by [Themesic Interactive](https://themesic.com) - the developers of
the **REST API module for Perfex CRM**, the API solution approved by the Perfex
CRM team and sold exclusively on CodeCanyon since 2019.

Perfex CRM is self-hosted and ships without a REST API. This node talks to the
API that our module adds to your own installation, so no third-party service
sits between n8n and your CRM.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and use the package name `@themesic/n8n-nodes-perfex-crm`.

## Prerequisites

- A Perfex CRM installation you control
- The [REST API module for Perfex CRM](https://codecanyon.net/item/rest-api-for-perfex-crm/25278359)
  installed on it
- An API token, generated in Perfex CRM under **Setup > API**

## Credentials

| Field | Description |
| --- | --- |
| Perfex CRM URL | Base URL of your installation, without a trailing slash |
| API Token | Token generated under Setup > API |

The token is sent as an `authtoken` header on every request.

## Operations

The **Perfex CRM** node covers 19 resources with create, get, get many, update,
delete and search operations where the API supports them:

Calendar events, contacts, contracts, credit notes, customers, estimates,
expenses, invoices, items, leads, milestones, payments, projects, proposals,
staff members, subscriptions, tasks, tickets and timesheets.

The **Perfex CRM Trigger** node polls for new customers, invoices, leads, tasks
and tickets.

## Notes on behaviour

Some Perfex endpoints answer `404 No data were found` instead of an empty list.
The node treats that as "no items" rather than an error, so an empty CRM does
not break a workflow.

List endpoints answer in two shapes depending on the resource - either
`{ data, meta }` or a bare array - and the node normalises both.

## Compatibility

Tested against n8n 1.x and the REST API module for Perfex CRM 2.1.x.

## Resources

- [API documentation](https://perfexcrm.themesic.com/apiguide/)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Trademarks

Perfex CRM is a trademark of its respective owner. This package is published by
Themesic Interactive, developer of the REST API module for Perfex CRM, and is
not affiliated with n8n GmbH.

## License

[MIT](LICENSE.md)
