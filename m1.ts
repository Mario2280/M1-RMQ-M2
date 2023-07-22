import bodyParser from 'body-parser'
import { Channel, connect } from 'amqplib'
import express, { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'

const PORT = 3001
const RABBITMQ_URL = 'amqp://localhost'
const EXCHANGE_NAME = 'taskExchange'
const QUEUE_NAME = 'taskQueue'
const OPERATIONS = ['plus', 'munis', 'div', 'mult']

let channel: Channel, connection
const app = express()
app.use(bodyParser.json())

async function createRMQConnection() {
	try {
		connection = await connect(RABBITMQ_URL)
		channel = await connection.createChannel()
		channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true })
	} catch (e) {
		console.error(e)
	}
}

;(async () => {
	await createRMQConnection()

	app.post('/runTask', async (req, res: Response) => {
		try {
			const operation = req.body.operation
			const { numbers } = req.body
			if (
				!numbers ||
				!Array.isArray(numbers) ||
				numbers.length < 2 ||
				!OPERATIONS.includes(operation) ||
				numbers[1] == 0
			) {
				res.status(400).json({ error: 'Invalid input' })
				return
			}

			const correlationId = uuidv4()
			const requestTask = new Promise(async (resolve) => {
				const { queue: replyTo } = await channel.assertQueue('', { exclusive: true })
				const { consumerTag } = await channel.consume(
					replyTo,
					(message) => {
						if (!message) console.warn('Consumer cancelled')
						else if (message.properties.correlationId === correlationId) {
							channel.cancel(consumerTag)
							resolve(message.content.toString())
						}
					},
					{ noAck: true }
				)
				channel.publish(
					EXCHANGE_NAME,
					'calculator.command',
					Buffer.from(JSON.stringify({ operation, numbers })),
					{
						replyTo,
						correlationId,
					}
				)
			})

			const result = await requestTask

			res.status(200).json({ result })
		} catch (error) {
			console.error('Error occurred:', error)
			res.status(500).json({ error: 'Internal server error' })
		}
	})

	app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`)
	})
})()
