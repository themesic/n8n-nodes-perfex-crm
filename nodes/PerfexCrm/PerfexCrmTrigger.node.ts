import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class PerfexCrmTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Perfex CRM Trigger',
		name: 'perfexCrmTrigger',
		icon: { light: 'file:perfexCrm.svg', dark: 'file:perfexCrm.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["resource"]}}',
		description: 'Starts a workflow when records appear in Perfex CRM',
		defaults: { name: 'Perfex CRM Trigger' },
		polling: true,
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'perfexCrmApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				description: 'Which records to watch for',
				options: [
					{ name: 'Customer', value: 'customers' },
					{ name: 'Invoice', value: 'invoices' },
					{ name: 'Lead', value: 'leads' },
					{ name: 'Task', value: 'tasks' },
					{ name: 'Ticket', value: 'tickets' },
				],
				default: 'customers',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1 },
				description: 'Max number of results to return',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const resource = this.getNodeParameter('resource') as string;
		const limit = this.getNodeParameter('limit', 50) as number;

		const credentials = await this.getCredentials('perfexCrmApi');
		const baseUrl = (credentials.url as string).replace(/\/$/, '');

		const staticData = this.getWorkflowStaticData('node');
		const seen = (staticData.seenIds as string[]) ?? [];

		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'perfexCrmApi',
			{
				method: 'GET',
				url: `${baseUrl}/api/zapier/poll/${resource}`,
				qs: { limit },
				json: true,
				ignoreHttpStatusErrors: true,
				returnFullResponse: true,
			},
		);

		const status = response.statusCode;
		const payload = response.body as IDataObject;

		if (status >= 400) {
			const detail = payload?.message ?? payload?.error;
			throw new NodeOperationError(
				this.getNode(),
				`Perfex CRM returned ${status}: ${
					typeof detail === 'string' ? detail : JSON.stringify(payload)
				}`,
			);
		}

		const records = (payload?.data as IDataObject[]) ?? [];
		if (records.length === 0) {
			return null;
		}

		const idOf = (record: IDataObject): string =>
			String(record.id ?? record.userid ?? record.ticketid ?? record.staffid ?? '');

		// On the first poll the workflow only records what already exists, so an
		// established installation does not replay its whole history.
		if (staticData.seenIds === undefined) {
			staticData.seenIds = records.map(idOf);
			return null;
		}

		const fresh = records.filter((record) => !seen.includes(idOf(record)));
		if (fresh.length === 0) {
			return null;
		}

		// Keep the window bounded so static data cannot grow without limit.
		staticData.seenIds = [...seen, ...fresh.map(idOf)].slice(-500);

		if (this.getMode() === 'manual') {
			return [this.helpers.returnJsonArray(records.slice(0, 1))];
		}

		return [this.helpers.returnJsonArray(fresh)];
	}
}
