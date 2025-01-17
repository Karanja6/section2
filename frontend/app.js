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
function renderOrders(orders) {
    const ordersTableBody = document.getElementById('ordersTable').getElementsByTagName('tbody')[0];
    ordersTableBody.innerHTML = ''; 
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.order_id}</td>
            <td>${order.customer_name}</td>
            <td>${order.order_date}</td>
            <td>${order.order_status}</td>
            <td>${order.payment_status}</td>
            <td>
                <button onclick="redirectToPaymentPage(${order.order_id})">Process Payment</button>
            </td>
        `;
        ordersTableBody.appendChild(row);
    });
}
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
function redirectToPaymentPage(orderId) {
    window.location.href = `payment.html?orderId=${orderId}`;
}
document.getElementById('showOrdersBtn').addEventListener('click', function() {
    const ordersTable = document.getElementById('ordersTable');
    if (ordersTable.style.display === 'none' || ordersTable.style.display === '') {
        fetchOrders(); 
        ordersTable.style.display = 'table'; 
    } else {
        ordersTable.style.display = 'none'; 
    }
});
