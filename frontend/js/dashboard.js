// 全局变量
let currentCardNumber = '';
let userBalance = '0.00'; // 存储真实金额
let isBalanceHidden = true; // 默认开启隐私模式

// 页面加载初始化
document.addEventListener('DOMContentLoaded', function() {
    currentCardNumber = sessionStorage.getItem('cardNumber');
    if (!currentCardNumber) {
        window.location.href = '/';
        return;
    }
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        await Promise.all([
            loadUserInfo(),
            loadBalance(),
            loadRecentTransactions()
        ]);
        document.getElementById('displayCardNumber').textContent = currentCardNumber;
        document.getElementById('cardNumberDisplay').textContent = currentCardNumber;
    } catch (error) {
        showMessage('页面初始化失败: ' + error.message, 'error');
    }
}

async function loadUserInfo() {
    try {
        const response = await fetch(`/api/userinfo/${currentCardNumber}`);
        const data = await response.json();
        if (data.status === 'success') {
            document.getElementById('userName').textContent = data.name;
        }
    } catch (error) {
        document.getElementById('userName').textContent = '用户';
    }
}

// 加载余额
async function loadBalance() {
    try {
        const response = await fetch(`/api/balance/${currentCardNumber}`);
        const data = await response.json();
        if (data.status === 'success') {
            userBalance = parseFloat(data.balance).toFixed(2);
            updateBalanceDisplay();
            // 模态框中始终显示真实金额
            document.getElementById('currentBalanceDeposit').textContent = `¥ ${userBalance}`;
            document.getElementById('currentBalanceWithdraw').textContent = `¥ ${userBalance}`;
        }
    } catch (error) {
        console.error(error);
    }
}

// 余额隐私切换
function toggleBalance() {
    isBalanceHidden = !isBalanceHidden;
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const displayEl = document.getElementById('balanceDisplay');
    const iconEl = document.getElementById('balanceIcon');

    if (isBalanceHidden) {
        displayEl.textContent = '¥ ****';
        iconEl.className = 'fas fa-eye-slash';
        iconEl.style.color = 'var(--second-text)';
    } else {
        displayEl.textContent = `¥ ${userBalance}`;
        iconEl.className = 'fas fa-eye';
        iconEl.style.color = 'var(--theme-color)';
    }
}

// === 新增：交易记录折叠切换 ===
function toggleTransactions() {
    const card = document.getElementById('transListCard');
    card.classList.toggle('expanded');
}

async function loadRecentTransactions() {
    try {
        const response = await fetch(`/api/transactions/${currentCardNumber}`);
        const data = await response.json();
        const container = document.getElementById('recentTransactions');

        if (data.status === 'success' && data.transactions.length > 0) {
            container.innerHTML = '';
            data.transactions.slice(0, 5).forEach(t => {
                const isIn = t.type === 'deposit';
                const typeText = isIn ? '存款' : '取款';
                const colorClass = isIn ? 'money-in' : 'money-out';
                const symbol = isIn ? '+' : '-';

                const html = `
                    <div class="trans-row">
                        <div>
                            <div style="font-weight:bold; font-size:15px; color: var(--font-color);">${typeText}</div>
                            <div style="font-size:12px; color:var(--second-text); margin-top:4px;">${new Date(t.create_time).toLocaleString()}</div>
                        </div>
                        <div style="text-align:right;">
                            <div class="${colorClass}" style="font-size:16px;">${symbol} ¥${Math.abs(t.amount).toFixed(2)}</div>
                            <div style="font-size:12px; color:var(--second-text); margin-top:4px;">余额: ¥${parseFloat(t.balance_after).toFixed(2)}</div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            container.innerHTML = '<div style="text-align:center; color:var(--second-text); padding:20px;">暂无交易记录</div>';
        }
    } catch (error) {
        document.getElementById('recentTransactions').innerHTML = '<div style="text-align:center; padding:20px;">加载失败</div>';
    }
}

// === 弹窗控制逻辑 ===
function showDepositModal() {
    document.getElementById('depositModal').style.display = 'flex';
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositAmount').focus();
}
function closeDepositModal() {
    document.getElementById('depositModal').style.display = 'none';
}

function showWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'flex';
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawAmount').focus();
}
function closeWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'none';
}

function showTransactionHistory() {
    const modal = document.getElementById('historyModal');
    const container = document.getElementById('transactionsTableBody');
    modal.style.display = 'flex';

    fetch(`/api/transactions/${currentCardNumber}`)
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success' && data.transactions.length > 0) {
                container.innerHTML = '';
                data.transactions.forEach(t => {
                    const isIn = t.type === 'deposit';
                    const html = `
                        <div style="display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px dashed rgba(255,255,255,0.1);">
                            <div>
                                <div style="font-weight:bold;">${isIn ? '存款' : '取款'}</div>
                                <div style="font-size:12px; color:var(--second-text);">${new Date(t.create_time).toLocaleString()}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:bold; color:${isIn ? 'var(--success)' : 'var(--danger)'}">
                                    ${isIn?'+':'-'} ${Math.abs(t.amount).toFixed(2)}
                                </div>
                                <div style="font-size:12px; color:var(--second-text);">余额: ${parseFloat(t.balance_after).toFixed(2)}</div>
                            </div>
                        </div>`;
                    container.insertAdjacentHTML('beforeend', html);
                });
            } else {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--second-text);">暂无记录</div>';
            }
        });
}
function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

// === 核心功能逻辑 ===
async function processDeposit() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (!amount || amount <= 0) return showMessage('请输入有效金额', 'error');

    try {
        const res = await fetch('/api/deposit', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({card_number: currentCardNumber, amount: amount})
        });
        const data = await res.json();
        if (data.status === 'success') {
            showMessage('存款成功', 'success');
            closeDepositModal();
            loadBalance();
            loadRecentTransactions();
        } else {
            showMessage(data.message, 'error');
        }
    } catch(e) { showMessage('操作失败', 'error'); }
}

async function processWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (!amount || amount <= 0) return showMessage('请输入有效金额', 'error');

    try {
        const res = await fetch('/api/withdraw', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({card_number: currentCardNumber, amount: amount})
        });
        const data = await res.json();
        if (data.status === 'success') {
            showMessage('取款成功', 'success');
            closeWithdrawModal();
            loadBalance();
            loadRecentTransactions();
        } else {
            showMessage(data.message, 'error');
        }
    } catch(e) { showMessage('操作失败', 'error'); }
}

// === 退出登录 ===
function logout() { showLogoutModal(); }
function showLogoutModal() { document.getElementById('logoutModal').style.display = 'flex'; }
function closeLogoutModal() { document.getElementById('logoutModal').style.display = 'none'; }
function confirmLogout() { sessionStorage.clear(); window.location.href = '/'; }

// === 通用工具 ===
function showAccountInfo() { window.location.href = '/profile.html'; }

function showMessage(msg, type) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.className = `snackbar ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

window.onclick = function(event) {
    const modals = ['depositModal', 'withdrawModal', 'historyModal', 'logoutModal'];
    if (modals.includes(event.target.id)) {
        event.target.style.display = 'none';
    }
}