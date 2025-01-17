const express = require('express');
const amqp = require('amqplib');
const { pool } = require('./db'); 

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
        console.log(`Order sent to orderQueue: ${msg}`);
        await channel.sendToQueue(paymentQueue, Buffer.from(msg));
        console.log(`Order sent to paymentQueue: ${msg}`);
        setTimeout(() => {
            connection.close();
        }, 500);
    } catch (error) {
        console.error('Error in sending order to queue:', error);
    }
}

module.exports = { sendOrderToQueue };

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

app.listen(4000, () => {
    console.log('Order Service is running on http://localhost:4000');
});
