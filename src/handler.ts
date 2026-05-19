import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // 1. Obtener shortId desde la URL
  const shortId = event.pathParameters?.shortId;

  // 2. Validar que exista
  if (!shortId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'shortId is required',
      }),
    };
  }

  try {
    // 3. Consultar DynamoDB
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        shortId: shortId,
      },
    });

    const response = await docClient.send(command);

    // 4. Verificar si existe el registro
    if (response.Item) {
      const originalUrl = response.Item.originalUrl;

      console.log(`Redirecting ${shortId} to ${originalUrl}`);

      // Incrementar clicks y agregar la fecha de la visita a la lista
      try {
        const timestamp = new Date().toISOString();
        const updateCommand = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            shortId: shortId,
          },
          UpdateExpression: 'SET clicks = if_not_exists(clicks, :zero) + :inc, visits = list_append(if_not_exists(visits, :empty_list), :new_visit)',
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':new_visit': [timestamp],
            ':empty_list': [],
          },
        });
        await docClient.send(updateCommand);
        console.log(`Successfully updated click stats for ${shortId}`);
      } catch (dbError) {
        console.error('Error updating click stats in DynamoDB:', dbError);
      }

      // 5. Redirección HTTP 302
      return {
        statusCode: 302,
        headers: {
          Location: originalUrl,
          'Access-Control-Allow-Origin': '*',
        },
      };
    }

    // 6. Si no existe
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: 'Not Found',
        message: 'The requested short link does not exist.',
      }),
    };
  } catch (error) {
    console.error('Error querying DynamoDB:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error',
      }),
    };
  }
};