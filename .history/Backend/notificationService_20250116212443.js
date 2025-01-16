const express = require('express');
const amqp = require('amqplib');  // Promise-based amqplib

// Notification handling function
async function receiveNotification(notificationDetails) {
    if (!notificationDetails || !notificationDetails.message || !notificationDetails.message.recipient || !notificationDetails.message.content) {
        console.error("Invalid notification details:", notificationDetails);
        return;
    }

    const { recipient, content } = notificationDetails.message;
    console.log(`Notification sent to ${recipient}: ${content}`);
}

// Connect to RabbitMQ and start the service
async function startNotificationService() {
    try {
        const connection = await amqp.connect('amqp://localhost');  // Connect to RabbitMQ
        const channel = await connection.createChannel();  // Create a channel

        const queue = 'notificationQueue';  // Consistent queue name
        await channel.assertQueue(queue, { durable: true });  // Declare the queue (if not already declared)
        console.log(`Notification Service waiting for messages in queue: ${queue}`);

        // Consume messages from the notificationQueue
        channel.consume(queue, (msg) => {
            if (msg) {
                try {
                    const notificationDetails = JSON.parse(msg.content.toString());  // Parse message content
                    console.log('Received notification message:', notificationDetails);

                    // Call the function to process the notification
                    receiveNotification(notificationDetails);

                    // Acknowledge the message after processing
                    channel.ack(msg);
                    console.log('Message acknowledged');
                } catch (error) {
                    console.error('Error processing message:', error);
                    // Negative acknowledgment to requeue the message for retry in case of an error
                    channel.nack(msg, false, true);  // Requeue the message for retry
                    console.log('Message requeued due to error');
                }
            }
        }, { noAck: false });
    } catch (error) {
        console.error('Error in Notification Service:', error);
    }
}

// Start the notification service
startNotificationService();

// Express server setup
const app = express();
app.get('/', (req, res) => {
    res.send('Notification Service is running');
});

app.listen(5000, () => {
    console.log('Notification Service running on http://localhost:5000');
});
