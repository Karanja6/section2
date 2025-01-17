const express = require('express');
const amqp = require('amqplib');

async function receiveNotification(notificationDetails) {
    if (!notificationDetails || !notificationDetails.message || !notificationDetails.message.recipient || !notificationDetails.message.content) {
        console.error("Invalid notification details:", notificationDetails);
        return;
    }
    const { recipient, content } = notificationDetails.message;
    console.log(`Notification sent to ${recipient}: ${content}`);
}
async function startNotificationService() {
    try {
        const connection = await amqp.connect('amqp://localhost');  
        const channel = await connection.createChannel(); 
        const queue = 'notificationQueue';  
        await channel.assertQueue(queue, { durable: true });  
        console.log(`Notification Service waiting for messages in queue: ${queue}`);

        channel.consume(queue, (msg) => {
            if (msg) {
                try {
                    const notificationDetails = JSON.parse(msg.content.toString());  
                    console.log('Received notification message:', notificationDetails);
                    receiveNotification(notificationDetails);
                    channel.ack(msg);
                    console.log('Message acknowledged');
                } catch (error) {
                    console.error('Error processing message:', error);
                    channel.nack(msg, false, true);  
                    console.log('Message requeued due to error');
                }
            }
        }, { noAck: false });
    } catch (error) {
        console.error('Error in Notification Service:', error);
    }
}

startNotificationService();

const app = express();
app.get('/', (req, res) => {
    res.send('Notification Service is running');
});

app.listen(5000, () => {
    console.log('Notification Service running on http://localhost:5000');
});

module.exports = { receiveNotification };
