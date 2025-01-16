const express = require('express');
const amqp = require('amqplib');
const { pool } = require('./db');  // Assuming you have a db connection module

// Function to process payment and interact with the database
async function processPayment(orderDetails, ch, msg) {
    console.log("Processing payment for order:", orderDetails);

    if (!ch || !msg) {
        console.error("Error: Channel or message is undefined when processing payment.");
        return;
    }

    try {
        // Simulate payment processing delay
        setTimeout(() => {
            pool.query(
                'INSERT INTO payment (order_id, payment_date, payment_status, amount) VALUES (?, NOW(), ?, ?)',
                [orderDetails.orderId, 'Paid', orderDetails.amount],
                (err) => {
                    if (err) {
                        console.error("Error processing payment:", err);
                        ch.nack(msg, false, true);  // Requeue the message for retry
                        console.log('Message requeued due to payment processing error');
                        return;
                    }

                    console.log(`Payment processed for Order ID: ${orderDetails.orderId}`);

                    // Send notification after payment processing
                    sendNotification(orderDetails, ch);

                    // Acknowledge the message after successful payment processing
                    ch.ack(msg);
                    console.log('Message acknowledged after payment processing');
                }
            );
        }, 2000); // Simulate payment delay
    } catch (error) {
        console.error('Error in processPayment:', error);
        ch.nack(msg, false, true);  // Requeue the message on error
        console.log('Message requeued due to payment processing failure');
    }
}

// Function to send a notification message to notificationQueue
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

    // Send the notification message to notificationQueue
    ch.sendToQueue('notificationQueue', Buffer.from(JSON.stringify(notificationMessage)));
    console.log('Notification message sent:', notificationMessage);
}

// Function to process an order from the paymentQueue
async function processOrderFromQueue(paymentDetails, ch, msg) {
    console.log('Processing order from payment queue:', paymentDetails);

    if (!ch || !msg) {
        console.error("Error: Channel or message is undefined when processing order.");
        return;
    }

    // Process the payment and send notification
    await processPayment(paymentDetails, ch, msg);
}

// Initialize the payment service and listen for messages
async function initializePaymentService() {
    try {
        // Connect to RabbitMQ
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        const queue = 'paymentQueue';  // Consistent queue name for payment messages
        await channel.assertQueue(queue, { durable: true });
        console.log(`Payment Service waiting for messages in queue: ${queue}`);

        // Consume messages from the paymentQueue
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const paymentDetails = JSON.parse(msg.content.toString()); // Parse the message
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

// Start the payment service
initializePaymentService();

// Express app setup for order service
const app = express();
app.use(express.json());

// POST endpoint to place an order
app.post('/placeOrder', (req, res) => {
    const { customerName, product, quantity } = req.body;

    // Insert order into MySQL database
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

            // Send order details to RabbitMQ payment queue
            sendOrderToQueue(order);

            // Respond to the client with success message
            res.status(200).send(`Order placed successfully with Order ID: ${orderId}`);
        }
    );
});

// Function to send order details to RabbitMQ
async function sendOrderToQueue(order) {
    try {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        const orderQueue = 'orderQueue';  // Ensure queue names are consistent
        const paymentQueue = 'paymentQueue';  // Ensure queue names are consistent

        await channel.assertQueue(orderQueue, { durable: true });
        await channel.assertQueue(paymentQueue, { durable: true });

        const msg = JSON.stringify(order);
        await channel.sendToQueue(orderQueue, Buffer.from(msg));
        console.log("Order sent to orderQueue:", msg);

        await channel.sendToQueue(paymentQueue, Buffer.from(msg));
        console.log("Order sent to paymentQueue:", msg);

        // Close the connection after a short delay to ensure messages are processed
        setTimeout(() => {
            connection.close();
        }, 500);
    } catch (error) {
        console.error('Error in sending order to queue:', error);
    }
}

// Start the order service
app.listen(4000, () => {
    console.log('Order Service is running on http://localhost:4000');
});
