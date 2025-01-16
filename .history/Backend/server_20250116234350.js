const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import the CORS package
const { sendOrderToQueue } = require('./orderService'); // Import the orderService function
const { processOrderFromQueue } = require('./PaymentService');
// Import the paymentService function
const { receiveNotification } = require('./notificationService');
const { pool } = require('./db'); // Import the pool from db.js

const app = express();

// Middleware to handle CORS (Allow specific origin)
app.use(cors({
    origin: 'http://127.0.0.1:5500',  // Only allow requests from this specific origin (your frontend)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allow specific methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
}));

// Middleware for parsing JSON bodies
app.use(bodyParser.json());

// Test database connection by querying a simple query
pool.query('SELECT 1', (err) => {
  if (err) {
    console.error('Database connection error:', err);
    return;
  }
  console.log('Database connected successfully');
});

// API endpoint to place a new order
app.post('/placeOrder', async (req, res) => {
    const { customerName, product, quantity } = req.body;
    console.log("Received order data:", { customerName, product, quantity });

    const query = 'INSERT INTO Orders (customer_name, order_date, order_status, payment_status) VALUES (?, NOW(), ?, ?)';
    pool.query(query, [customerName, 'Pending', 'Unpaid'], async (err, result) => {
        if (err) {
            console.error("Error inserting order into MySQL:", err);
            return res.status(500).json({ message: 'Failed to place order', error: err });
        }

        const orderId = result.insertId;
const orderDetails = {
    orderId,
    customerName,
    product,
    orderStatus: 'Unpaid',
    paramOne: 'someValueOne',   
    paramTwo: 'someValueTwo'   
};

sendOrderToQueue(orderDetails);
        console.log("Order details to be sent to the queue:", orderDetails);

        try {
            // Send the order details to the order processing queue
            await sendOrderToQueue(orderDetails);
            console.log(`Order placed and sent to queue with Order ID: ${orderId}`);
        } catch (error) {
            console.error('Error sending order to queue:', error);
            return res.status(500).json({ message: 'Error sending order to queue', error });
        }

        // Respond to the client with success message
        res.status(200).json({ orderId: result.insertId, message: 'Order placed successfully' });
    });
});

// API endpoint to get all orders
app.get('/orders', (req, res) => {
    const query = 'SELECT * FROM Orders';
    pool.query(query, (err, results) => {
        if (err) {
            console.error("Failed to fetch orders:", err);
            return res.status(500).json({ message: 'Failed to fetch orders', error: err });
        }
        res.status(200).json(results);
    });
});

// API endpoint to process payment for an order
app.post('/processPayment', (req, res) => {
    const { orderId, amount, paymentStatus } = req.body;

    const query = 'INSERT INTO Payment (order_id, payment_date, amount, payment_status) VALUES (?, NOW(), ?, ?)';
    pool.query(query, [orderId, amount, paymentStatus], (err, result) => {
        if (err) {
            console.error("Error processing payment:", err);
            return res.status(500).json({ message: 'Failed to process payment', error: err });
        }

        // After successfully processing the payment, update the order and send it to the payment service
        const updateOrderQuery = 'UPDATE Orders SET payment_status = ? WHERE order_id = ?';
        pool.query(updateOrderQuery, [paymentStatus, orderId], (err, updateResult) => {
            if (err) {
                console.error("Error updating order payment status:", err);
                return res.status(500).json({ message: 'Failed to update order payment status', error: err });
            }

            // Send the payment information to the payment processing service (paymentService)
            const paymentDetails = {
                orderId,
                amount,
                paymentStatus
            };

            processOrderFromQueue(paymentDetails);  // Process payment in payment service

            // Notify via notification service
            receiveNotification({ message: `Payment processed for Order ID: ${orderId}, Status: ${paymentStatus}` });

            res.status(200).json({ message: 'Payment processed successfully', paymentId: result.insertId });
        });
    });
});
for (let i = 0; i < 5; i++) {
    const orderDetails = {
        orderId: i + 1,
        customerName: `Customer ${i + 1}`,
        orderStatus: 'Unpaid',
        paramOne: `valueOne-${i + 1}`,
        paramTwo: `valueTwo-${i + 1}`
    };

    await sendOrderToQueue(orderDetails);
}

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
