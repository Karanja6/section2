const amqp = require('amqplib'); // Use the 'amqplib' library
const { pool } = require('./db'); // Assuming you have a database connection module

// Process the payment and simulate interaction with the database
async function processPayment(orderDetails, ch, msg) {
    console.log("Processing payment for order:", orderDetails);

    try {
        // Simulate delay in payment processing
        setTimeout(() => {
            pool.query(
                'INSERT INTO payment (order_id, payment_date, payment_status, amount) VALUES (?, NOW(), ?, ?)',
                [orderDetails.orderId, 'Paid', orderDetails.amount],
                (err) => {
                    if (err) {
                        console.error("Error processing payment:", err);

                        // Negative acknowledgment on error, message is requeued for retry
                        ch.nack(msg, false, true);
                        console.log('Message requeued due to payment processing error');
                        return;
                    }

                    console.log(`Payment processed for Order ID: ${orderDetails.orderId}`);

                    // Create the notification message for sending
                    const notificationMessage = {
                        message: {
                            recipient: orderDetails.customerName,
                            content: `Payment processed for Order ID: ${orderDetails.orderId}, Status: Paid`
                        }
                    };

                    // Send the notification message to notificationQueue
                    if (ch) {
                        ch.sendToQueue('notificationQueue', Buffer.from(JSON.stringify(notificationMessage)));
                        console.log('Notification message sent:', notificationMessage);
                    } else {
                        console.error("Error: Channel is undefined when sending notification message");
                    }

                    // Acknowledge the message after payment is processed
                    if (ch && msg) {
                        ch.ack(msg); // Acknowledge message after successful payment processing
                        console.log('Message acknowledged after payment processing');
                    } else {
                        console.error("Error: Channel or message is undefined during acknowledgment");
                    }
                }
            );
        }, 2000); // Simulate delay in payment processing
    } catch (error) {
        console.error('Error in processPayment:', error);

        // Ensure message is requeued if an error occurs
        ch.nack(msg, false, true);  // Requeue the message
        console.log('Message requeued due to payment processing failure');
    }
}

// Function to handle order processing from paymentQueue
function processOrderFromQueue(paymentDetails, ch, msg) {
    console.log('Processing order from payment queue:', paymentDetails);

    // Ensure both channel (ch) and message (msg) are passed correctly before processing
    if (ch && msg) {
        processPayment(paymentDetails, ch, msg); // Process payment and send notification
    } else {
        console.error("Error: Channel or message is undefined when processing order");
    }
}
module.exports = { processOrderFromQueue, processPayment };
// Initialize the payment service and listen for messages
async function initializePaymentService() {
    try {
        // Connect to RabbitMQ
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        // Declare the paymentQueue
        const queue = 'paymentQueue'; // Consistent queue name
        await channel.assertQueue(queue, { durable: true });
        console.log(`Payment Service waiting for messages in queue: ${queue}`);

        // Consume messages from the paymentQueue
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const orderDetails = JSON.parse(msg.content.toString());
                processOrderFromQueue(orderDetails, channel, msg);
            }
        }, { noAck: false });
    } catch (error) {
        console.error('Error in Payment Service:', error);
    }
}

// Start the payment service
initializePaymentService();
