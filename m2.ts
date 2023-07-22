////Sub
import { connect } from 'amqplib'

const RABBITMQ_URL = 'amqp://localhost'
const EXCHANGE_NAME = 'taskExchange'
const QUEUE_NAME = 'taskQueue'

const run = async () => {
	try {
		const connection = await connect(RABBITMQ_URL)
		const channel = await connection.createChannel()
		await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true })
		const queue = await channel.assertQueue(QUEUE_NAME, { durable: true })
		channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'calculator.command')
		channel.consume(
			queue.queue,
			(msg) => {
				if (!msg) return

				const { operation, numbers } = JSON.parse(msg.content.toString())
				let res
				switch (operation) {
					case 'plus':
						res = numbers[0] + numbers[1]
						break
					case 'munis':
						res = numbers[0] - numbers[1]
						break
					case 'div':
						res = numbers[0] / numbers[1]
						break
					case 'mult':
						res = numbers[0] * numbers[1]
						break
				}

				channel.sendToQueue(msg.properties.replyTo, Buffer.from(res.toString()), {
					correlationId: msg.properties.correlationId,
				})
			},
			{
				noAck: true,
			}
		)
	} catch (error) {
		console.log(error)
	}
}

run()
