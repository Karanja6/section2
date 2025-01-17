const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sendOrderToQueue } = require('./orderService');  
const { processOrderFromQueue } = require('./paymentService'); 
const { receiveNotification } = require('./notificationService');  
const { pool } = require('./db'); 

const app = express();

app.use(cors({
    origin: 'http://127.0.0.1:5500',  
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json());

pool.query('SELECT 1', (err) => {
  if (err) {
    console.error('Database connection error:', err);
    return;
  }
  console.log('Database connected successfully');
});
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

        console.log(`Order placed and sent to queue with Order ID: ${orderId}`);

        try {
            await sendOrderToQueue(orderDetails);
        } catch (error) {
            console.error('Error sending order to queue:', error);
            return res.status(500).json({ message: 'Error sending order to queue', error });
        }

        res.status(200).json({ orderId: result.insertId, message: 'Order placed successfully' });
    });
});

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

app.post('/processPayment', (req, res) => {
    const { orderId, amount, paymentStatus } = req.body;

    const query = 'INSERT INTO Payment (order_id, payment_date, amount, payment_status) VALUES (?, NOW(), ?, ?)';
    pool.query(query, [orderId, amount, paymentStatus], (err, result) => {
        if (err) {
            console.error("Error processing payment:", err);
            return res.status(500).json({ message: 'Failed to process payment', error: err });
        }
        const updateOrderQuery = 'UPDATE Orders SET payment_status = ? WHERE order_id = ?';
        pool.query(updateOrderQuery, [paymentStatus, orderId], (err, updateResult) => {
            if (err) {
                console.error("Error updating order payment status:", err);
                return res.status(500).json({ message: 'Failed to update order payment status', error: err });
            }

            const paymentDetails = {
                orderId,
                amount,
                paymentStatus
            };

            processOrderFromQueue(paymentDetails);
            receiveNotification({ message: `Payment processed for Order ID: ${orderId}, Status: ${paymentStatus}` });

            res.status(200).json({ message: 'Payment processed successfully', paymentId: result.insertId });
        });
    });
});

async function sendMultipleOrders() {
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
}
sendMultipleOrders();

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
