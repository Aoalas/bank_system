// 全局变量
let currentCardNumber = '';

// 页面加载初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    currentCardNumber = sessionStorage.getItem('cardNumber');
    if (!currentCardNumber) {
        window.location.href = '/';
        return;
    }
    
    // 初始化页面数据
    initializeDashboard();
});

// 初始化仪表板
async function initializeDashboard() {
    try {
        // 并行加载用户信息和余额
        await Promise.all([
            loadUserInfo(),
            loadBalance(),
            loadRecentTransactions()
        ]);
        
        // 更新卡号显示
        document.getElementById('displayCardNumber').textContent = currentCardNumber;
        document.getElementById('cardNumberDisplay').textContent = currentCardNumber;
        
    } catch (error) {
        showMessage('页面初始化失败: ' + error.message, 'error');
    }
}

// 加载用户信息
async function loadUserInfo() {
    try {
        const response = await fetch(`/api/userinfo/${currentCardNumber}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            document.getElementById('userName').textContent = data.name;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
        document.getElementById('userName').textContent = '用户';
    }
}

// 加载余额
async function loadBalance() {
    showSkeleton('balanceDisplay');
    try {
        const response = await fetch(`/api/balance/${currentCardNumber}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const balance = parseFloat(data.balance).toFixed(2);
            document.getElementById('balanceDisplay').textContent = `¥ ${balance}`;
            // 更新模态框中的余额显示
            document.getElementById('currentBalanceDeposit').textContent = `¥ ${balance}`;
            document.getElementById('currentBalanceWithdraw').textContent = `¥ ${balance}`;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('加载余额失败:', error);
        showMessage('加载余额失败', 'error');
        hideSkeleton('balanceDisplay');
    }
}

// 加载最近交易记录
async function loadRecentTransactions() {
    showSkeleton('recentTransactions');
    try {
        const response = await fetch(`/api/transactions/${currentCardNumber}`);
        const data = await response.json();
        
        const transactionsContainer = document.getElementById('recentTransactions');
        
        if (data.status === 'success' && data.transactions.length > 0) {
            // 显示最近5笔交易
            const recentTransactions = data.transactions.slice(0, 5);
            transactionsContainer.innerHTML = '';
            
            recentTransactions.forEach(transaction => {
                const transactionElement = createTransactionElement(transaction);
                transactionsContainer.appendChild(transactionElement);
            });
        } else {
            transactionsContainer.innerHTML = '<div class="loading-text">暂无交易记录</div>';
            hideSkeleton('recentTransactions');
        }
    } catch (error) {
        console.error('加载交易记录失败:', error);
        document.getElementById('recentTransactions').innerHTML = '<div class="loading-text">加载失败</div>';
        hideSkeleton('recentTransactions');
    }
}

// 创建交易记录元素
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    
    const typeText = transaction.type === 'deposit' ? '存款' : 
                    transaction.type === 'withdraw' ? '取款' : 
                    transaction.type;
    const amountClass = transaction.type === 'deposit' ? 'transaction-type-deposit' : 'transaction-type-withdraw';
    const amountPrefix = transaction.type === 'deposit' ? '+' : '-';
    
    div.innerHTML = `
        <div class="transaction-main">
            <span class="transaction-type ${amountClass}">${typeText}</span>
            <span class="transaction-amount ${amountClass}">${amountPrefix}¥ ${Math.abs(parseFloat(transaction.amount)).toFixed(2)}</span>
        </div>
        <div class="transaction-details">
            <span class="transaction-time">${formatTime(transaction.create_time)}</span>
            <span class="transaction-balance">余额: ¥ ${parseFloat(transaction.balance_after).toFixed(2)}</span>
        </div>
        <div class="transaction-description">${transaction.description || ''}</div>
    `;
    
    return div;
}

// 格式化时间
function formatTime(timeString) {
    const date = new Date(timeString);
    return date.toLocaleString('zh-CN');
}

// 存款功能
function showDepositModal() {
    const modal = document.getElementById('depositModal');
    modal.style.display = 'block';
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositAmount').focus();
}

function closeDepositModal() {
    document.getElementById('depositModal').style.display = 'none';
}

async function processDeposit() {
    const amountInput = document.getElementById('depositAmount');
    const amount = parseFloat(amountInput.value);
    
    if (!amount || amount <= 0) {
        showMessage('请输入有效的存款金额', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_number: currentCardNumber,
                amount: amount
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showMessage(`存款成功！金额: ¥${amount.toFixed(2)}`, 'success');
            closeDepositModal();
            // 刷新余额和交易记录
            await loadBalance();
            await loadRecentTransactions();
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('存款操作失败: ' + error.message, 'error');
    }
}

// 取款功能
function showWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    modal.style.display = 'block';
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawAmount').focus();
}

function closeWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'none';
}

async function processWithdraw() {
    const amountInput = document.getElementById('withdrawAmount');
    const amount = parseFloat(amountInput.value);
    
    if (!amount || amount <= 0) {
        showMessage('请输入有效的取款金额', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_number: currentCardNumber,
                amount: amount
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showMessage(`取款成功！金额: ¥${amount.toFixed(2)}`, 'success');
            closeWithdrawModal();
            // 刷新余额和交易记录
            await loadBalance();
            await loadRecentTransactions();
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('取款操作失败: ' + error.message, 'error');
    }
}

// 交易记录功能
async function showTransactionHistory() {
    const modal = document.getElementById('historyModal');
    const tableBody = document.getElementById('transactionsTableBody');
    
    // 显示加载中
    tableBody.innerHTML = '<tr><td colspan="5" class="loading-text">加载中...</td></tr>';
    modal.style.display = 'block';
    
    try {
        const response = await fetch(`/api/transactions/${currentCardNumber}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.transactions.length > 0) {
            tableBody.innerHTML = '';
            
            data.transactions.forEach(transaction => {
                const row = createTransactionTableRow(transaction);
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading-text">暂无交易记录</td></tr>';
        }
    } catch (error) {
        console.error('加载交易记录失败:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="loading-text">加载失败</td></tr>';
    }
}

function createTransactionTableRow(transaction) {
    const row = document.createElement('tr');
    
    const typeText = transaction.type === 'deposit' ? '存款' : 
                    transaction.type === 'withdraw' ? '取款' : 
                    transaction.type;
    const amountClass = transaction.type === 'deposit' ? 'transaction-type-deposit' : 'transaction-type-withdraw';
    const amountDisplay = transaction.type === 'deposit' ? 
        `+¥ ${parseFloat(transaction.amount).toFixed(2)}` : 
        `-¥ ${parseFloat(transaction.amount).toFixed(2)}`;
    
    row.innerHTML = `
        <td>${formatTime(transaction.create_time)}</td>
        <td><span class="${amountClass}">${typeText}</span></td>
        <td><span class="${amountClass}">${amountDisplay}</span></td>
        <td>¥ ${parseFloat(transaction.balance_after).toFixed(2)}</td>
        <td>${transaction.description || '-'}</td>
    `;
    
    return row;
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

// 账户信息功能
async function showAccountInfo() {
    try {
        const response = await fetch(`/api/userinfo/${currentCardNumber}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const info = `
姓名: ${data.name}
卡号: ${data.card_number}
手机: ${data.phone}
余额: ¥ ${parseFloat(data.balance).toFixed(2)}
开户时间: ${formatTime(data.create_time)}
            `.trim();
            
            alert(info);
        } else {
            showMessage('获取账户信息失败', 'error');
        }
    } catch (error) {
        showMessage('获取账户信息失败: ' + error.message, 'error');
    }
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        sessionStorage.clear();
        window.location.href = '/';
    }
}

// 显示消息提示
function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// 模态框点击外部关闭
window.onclick = function(event) {
    const depositModal = document.getElementById('depositModal');
    const withdrawModal = document.getElementById('withdrawModal');
    const historyModal = document.getElementById('historyModal');
    
    if (event.target === depositModal) {
        closeDepositModal();
    }
    if (event.target === withdrawModal) {
        closeWithdrawModal();
    }
    if (event.target === historyModal) {
        closeHistoryModal();
    }
}

// 键盘事件支持
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeDepositModal();
        closeWithdrawModal();
        closeHistoryModal();
    }
});

document.getElementById('btnWithdrawAll').addEventListener('click', () => {
    const cur = document.getElementById('currentBalanceWithdraw').textContent.replace(/[¥,]/g, '');
    if (+cur <= 0) return showMessage('余额为 0', 'error');
    document.getElementById('withdrawAmount').value = cur;
});
//加载动画
function showSkeleton(containerId) {
    const box = document.getElementById(containerId);
    box.innerHTML = '<div class="skeleton"></div>'.repeat(containerId === 'balanceDisplay' ? 1 : 3);
    box.classList.add('skeleton');
}
function hideSkeleton(containerId) {
    const box = document.getElementById(containerId);
    box.classList.remove('skeleton');
}
