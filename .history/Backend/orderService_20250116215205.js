const express = require('express');
const amqp = require('amqplib');
const { pool } = require('./db'); // Ensure your MySQL pool is set up correctly

// Function to send order details to RabbitMQ
async function sendOrderToQueue(order) {
    try {
        // Connect to RabbitMQ and create a channel
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        const orderQueue = 'orderQueue';  // Ensure queue names are consistent
        const paymentQueue = 'paymentQueue';  // Ensure queue names are consistent

        // Declare both queues (ensuring they exist)
        await channel.assertQueue(orderQueue, { durable: true });
        await channel.assertQueue(paymentQueue, { durable: true });

        // Convert order object to string and send to both queues
        const msg = JSON.stringify(order);
        await channel.sendToQueue(orderQueue, Buffer.from(msg));
        console.log("Order sent to orderQueue:", msg);

        await channel.sendToQueue(paymentQueue, Buffer.from(msg));
        console.log("Order sent to paymentQueue:", msg);

        // Close the connection after a short delay to ensure the messages are processed
        setTimeout(() => {
            connection.close();
        }, 500);
    } catch (error) {
        console.error('Error in sending order to queue:', error);
    }
}
module.exports = { sendOrderToQueue };
// Express app setup
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

            // Send order details to RabbitMQ
            sendOrderToQueue(order);

            // Respond to the client with success message
            res.status(200).send(`Order placed successfully with Order ID: ${orderId}`);
        }
    );
});

// Start the server
app.listen(4000, () => {
    console.log('Order Service is running on http://localhost:4000');
});
