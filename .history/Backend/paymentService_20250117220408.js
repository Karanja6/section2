const express = require('express');
const amqp = require('amqplib');
const { pool } = require('./db');

async function processPayment(orderDetails, ch, msg) {
    console.log("Processing payment for order:", orderDetails);

    if (!ch || !msg) {
        console.error("Error: Channel or message is undefined when processing payment.");
        return;
    }

    try {
        setTimeout(() => {
            pool.query(
                'INSERT INTO payment (order_id, payment_date, payment_status, amount) VALUES (?, NOW(), ?, ?)',
                [orderDetails.orderId, 'Paid', orderDetails.amount],
                (err) => {
                    if (err) {
                        console.error("Error processing payment:", err);
                        ch.nack(msg, false, true); 
                        console.log('Message requeued due to payment processing error');
                        return;
                    }

                    console.log(`Payment processed for Order ID: ${orderDetails.orderId}`);

                    sendNotification(orderDetails, ch);
                    ch.ack(msg);
                    console.log('Message acknowledged after payment processing');
                }
            );
        }, 2000); 
    } catch (error) {
        console.error('Error in processPayment:', error);
        ch.nack(msg, false, true);  
        console.log('Message requeued due to payment processing failure');
    }
}

function sendNotification(orderDetails, ch) {
    if (!ch) {
        console.error("Error: Channel is undefined when sending notification.");
        return;
    }

    const notificationMessage = {
        message: {
            recipient: orderDetails.customerName,
            content: `Payment processed for Order ID: ${orderDetails.orderId}, Status: Paid`
        }
    };

    ch.sendToQueue('notificationQueue', Buffer.from(JSON.stringify(notificationMessage)));
    console.log('Notification message sent:', notificationMessage);
}

async function processOrderFromQueue(paymentDetails, ch, msg) {
    console.log('Processing order from payment queue:', paymentDetails);

    if (!ch || !msg) {
        console.error("Error: Channel or message is undefined when processing order.");
        return;
    }
    await processPayment(paymentDetails, ch, msg);
}

async function initializePaymentService() {
    try {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();
        const queue = 'paymentQueue';  
        await channel.assertQueue(queue, { durable: true });
        console.log(`Payment Service waiting for messages in queue: ${queue}`);

        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const paymentDetails = JSON.parse(msg.content.toString()); 
                console.log('Received payment message:', paymentDetails);
                processOrderFromQueue(paymentDetails, channel, msg);
            } else {
                console.error("Received an empty message from the queue");
            }
        }, { noAck: false });
    } catch (error) {
        console.error('Error in Payment Service:', error);
    }
}

initializePaymentService();

const app = express();
app.use(express.json());
app.post('/placeOrder', (req, res) => {
    const { customerName, product, quantity } = req.body;
    pool.query(
        'INSERT INTO orders (customer_name, order_date, order_status) VALUES (?, NOW(), ?)',
        [customerName, 'Pending'],
        (err, result) => {
            if (err) {
                console.error("Error inserting order into MySQL:", err);
                return res.status(500).send("Error placing order");
            }
            const orderId = result.insertId;
            const order = { orderId, customerName, product, quantity };
            sendOrderToQueue(order);
            res.status(200).send(`Order placed successfully with Order ID: ${orderId}`);
        }
    );
});

async function sendOrderToQueue(order) {
    try {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();
        const orderQueue = 'orderQueue';  
        const paymentQueue = 'paymentQueue';  
        await channel.assertQueue(orderQueue, { durable: true });
        await channel.assertQueue(paymentQueue, { durable: true });
        const msg = JSON.stringify(order);
        await channel.sendToQueue(orderQueue, Buffer.from(msg));
        console.log("Order sent to orderQueue:", msg);
        await channel.sendToQueue(paymentQueue, Buffer.from(msg));
        console.log("Order sent to paymentQueue:", msg);

        setTimeout(() => {
            connection.close();
        }, 500);
    } catch (error) {
        console.error('Error in sending order to queue:', error);
    }
}
app.listen(5001, () => {
    console.log('Order Service is running on http://localhost:5001');
});
