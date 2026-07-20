import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PerfexCrmApi implements ICredentialType {
	name = 'perfexCrmApi';

	displayName = 'Perfex CRM API';

	documentationUrl = 'https://perfexcrm.themesic.com/apiguide/';

	properties: INodeProperties[] = [
		{
			displayName: 'Perfex CRM URL',
			name: 'url',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://crm.example.com',
			description:
				'Base URL of your Perfex CRM installation, without a trailing slash. Perfex CRM is self-hosted, so this is your own domain.',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Token generated in Perfex CRM under Setup > API. Requires the REST API module for Perfex CRM to be installed on your Perfex installation.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				authtoken: '={{$credentials.apiToken}}',
			},
		},
	};

	// The polling endpoint is used rather than a list endpoint on purpose: list
	// endpoints answer 404 on a fresh Perfex installation, which would stop new
	// users from connecting at all. This one answers 200 with an empty array
	// when there is no data, and 404 when the token is wrong.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url.replace(new RegExp("/$"), "")}}',
			url: '/api/zapier/poll/customers',
			qs: { limit: 1 },
		},
	};
}
