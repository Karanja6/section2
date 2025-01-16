// Fetch and display existing orders from the backend
async function fetchOrders() {
    try {
        const response = await fetch('http://localhost:3000/orders');
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        const orders = await response.json();
        renderOrders(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        alert('Failed to fetch orders. Please try again later.');
    }
}

// Render orders into the table
function renderOrders(orders) {
    const ordersTableBody = document.getElementById('ordersTable').getElementsByTagName('tbody')[0];
    ordersTableBody.innerHTML = ''; // Clear existing rows

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.order_id}</td>
            <td>${order.customer_name}</td>
            <td>${order.order_date}</td>
            <td>${order.order_status}</td>
            <td>${order.payment_status}</td>
            <td>
                <button onclick="showPaymentForm(${order.order_id})">Process Payment</button>
            </td>
        `;
        ordersTableBody.appendChild(row);
    });
}

// Handle Order Form submission to create a new order
document.getElementById('orderForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    const orderStatus = document.getElementById('orderStatus').value;

    const orderData = { customerName, orderStatus };

    try {
        const response = await fetch('http://localhost:3000/placeOrder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            fetchOrders(); // Reload orders list
        } else {
            alert('Error placing order: ' + result.message);
        }
    } catch (error) {
        console.error('Error placing order:', error);
        alert('Error placing order. Please try again later.');
    }
});

// Show the payment form for a selected order
function showPaymentForm(orderId) {
    document.getElementById('orderId').value = orderId;

    // Generate a Payment ID dynamically (e.g., based on timestamp or UUID)
    const paymentId = 'PAY' + Date.now();  // Simple example using timestamp
    document.getElementById('paymentId').value = paymentId;

    // Show the payment form
    document.querySelector('.payment-form').classList.remove('hidden');
}

// Handle Payment Form submission
document.getElementById('paymentForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const orderId = document.getElementById('orderId').value;
    const paymentId = document.getElementById('paymentId').value;
    const amount = document.getElementById('amount').value;
    const paymentStatus = document.getElementById('paymentStatus').value;

    const paymentData = { orderId, paymentId, amount, paymentStatus };

    try {
        const response = await fetch('http://localhost:3000/processPayment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            fetchOrders(); // Reload orders list
            document.querySelector('.payment-form').classList.add('hidden'); // Hide payment form
        } else {
            alert('Error processing payment: ' + result.message);
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        alert('Error processing payment. Please try again later.');
    }
});

// Toggle visibility of orders table
document.getElementById('showOrdersBtn').addEventListener('click', function() {
    const ordersTable = document.getElementById('ordersTable');

    // Check if the table is currently hidden
    if (ordersTable.style.display === 'none' || ordersTable.style.display === '') {
        fetchOrders();  // Fetch the orders and display them
        ordersTable.style.display = 'table';  // Make the orders table visible
    } else {
        ordersTable.style.display = 'none';  // Hide the orders table
    }
});
