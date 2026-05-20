import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const jsonResponse = (statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders,
  },
  body: JSON.stringify(body),
});

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext?.http?.method;
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (!TABLE_NAME) {
    return jsonResponse(500, { message: 'TABLE_NAME is not configured' });
  }

  const shortId = event.pathParameters?.shortId;
  if (!shortId) {
    return jsonResponse(400, { message: 'shortId is required' });
  }

  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { shortId },
      })
    );

    if (!response.Item) {
      return jsonResponse(404, {
        error: 'Not Found',
        message: 'The requested short link does not exist.',
      });
    }

    const originalUrl = response.Item.originalUrl;
    const isResolveRequest = event.queryStringParameters?.resolve === 'true';

    if (isResolveRequest) {
      return jsonResponse(200, {
        shortId,
        originalUrl,
      });
    }

    const timestamp = new Date().toISOString();

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { shortId },
          UpdateExpression:
            'SET clicks = if_not_exists(clicks, :zero) + :inc, visits = list_append(if_not_exists(visits, :empty_list), :new_visit)',
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':new_visit': [timestamp],
            ':empty_list': [],
          },
        })
      );
    } catch (dbError) {
      console.error('Error updating click stats in DynamoDB:', dbError);
    }

    return {
      statusCode: 302,
      headers: {
        Location: originalUrl,
        ...corsHeaders,
      },
    };
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    return jsonResponse(500, { message: 'Internal Server Error' });
  }
};
