console.log('Dashboard JS v7.0');

let currentCardNumber = '';
let userBalance = '0.00';
let isBalanceHidden = true;
let currentMessages = [];

document.addEventListener('DOMContentLoaded', function() {
    currentCardNumber = sessionStorage.getItem('cardNumber');
    if (!currentCardNumber) {
        window.location.href = '/';
        return;
    }
    startClock();
    setGreeting();
    initializeDashboard();
});


function startClock() {
    const el = document.getElementById('sysTime');
    if (!el) {
        console.warn('sysTime element not found!');
        return;
    }

    function update() {
        const now = new Date();

        // 日期部分：YYYY年MM月DD日
        const datePart = now.getFullYear() + '年' +
            String(now.getMonth() + 1).padStart(2, '0') + '月' +
            String(now.getDate()).padStart(2, '0') + '日';

        // 时间部分：HH:mm (不含秒)
        const timePart = String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');

        el.textContent = `${datePart} ${timePart}`;
    }

    update(); // 立即执行一次，防止页面只有 "--:--:--"
    setInterval(update, 1000); // 每秒刷新，保证分钟跳变准确
}
// === 随机问候语 ===
function setGreeting() {
    const hour = new Date().getHours();
    let timeText = '';
    if (hour < 6) timeText = '夜深了，辛苦了';
    else if (hour < 9) timeText = '早上好，元气满满';
    else if (hour < 12) timeText = '上午好，工作顺利';
    else if (hour < 14) timeText = '中午好，记得午休';
    else if (hour < 18) timeText = '下午好，继续加油';
    else timeText = '晚上好，享受生活';

    const quotes = [
        "财富积累始于点滴。",
        "理财就是理生活。",
        "每一笔储蓄都是未来的礼物。",
        "保持专注，未来可期。",
        "星光不问赶路人。",
        "今天也是充满希望的一天。"
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    const el = document.getElementById('greeting');
    if(el) el.textContent = `${timeText}，${randomQuote}`;
}

async function initializeDashboard() {
    try {
        await Promise.all([
            loadUserInfo(),
            loadBalance(),
            loadRecentTransactions()
        ]);
        loadMessages();

        const els = ['displayCardNumber', 'cardNumberDisplay'];
        els.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.textContent = currentCardNumber;
        });
    } catch (error) { console.error(error); }
}

async function loadUserInfo() {
    try {
        const res = await fetch(`/api/userinfo/${currentCardNumber}`);
        const data = await res.json();
        if (data.status === 'success') document.getElementById('userName').textContent = data.name;
    } catch(e){}
}

async function loadBalance() {
    try {
        const res = await fetch(`/api/balance/${currentCardNumber}`);
        const data = await res.json();
        if (data.status === 'success') {
            userBalance = parseFloat(data.balance).toFixed(2);
            updateBalanceDisplay();
        }
    } catch(e){}
}

function toggleBalance() {
    isBalanceHidden = !isBalanceHidden;
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const el = document.getElementById('balanceDisplay');
    const icon = document.getElementById('balanceIcon');
    if(!el) return;
    if (isBalanceHidden) {
        el.textContent = '¥ ****';
        icon.className = 'fas fa-eye-slash';
        icon.style.color = 'var(--anzhiyu-secondtext)';
    } else {
        el.textContent = `¥ ${userBalance}`;
        icon.className = 'fas fa-eye';
        icon.style.color = 'var(--anzhiyu-theme)';
    }
}

function toggleTransactions() {
    const card = document.getElementById('transListCard');
    if(card) card.classList.toggle('expanded');
}

// === 交易记录显示逻辑（包含历史数据修正） ===
function renderTransactionItem(t) {
    let typeText = t.type;
    let isIn = false;

    // 智能判断：优先看 type，如果是旧数据(withdraw/deposit)，则检查描述是否包含"转账"
    if (t.type === 'tr_out') {
        typeText = '发起转账';
    } else if (t.type === 'tr_in') {
        typeText = '接收转账';
        isIn = true;
    } else if (t.type === 'open') {
        typeText = '开户';
        isIn = true;
    } else if (t.type === 'deposit') {
        // 兼容旧数据：如果是存款类型，但描述包含"转账"，则显示为接收转账
        if (t.description && t.description.includes('转账')) {
            typeText = '接收转账';
        } else {
            typeText = '存款';
        }
        isIn = true;
    } else if (t.type === 'withdraw') {
        // 兼容旧数据
        if (t.description && t.description.includes('转账')) {
            typeText = '发起转账';
        } else {
            typeText = '取款';
        }
    }

    const colorClass = isIn ? 'money-in' : 'money-out';
    const symbol = isIn ? '+' : '-';

    return `
        <div class="trans-row">
            <div>
                <div style="font-weight:bold; font-size:15px; color: var(--anzhiyu-fontcolor);">${typeText}</div>
                <div style="font-size:12px; color:var(--anzhiyu-secondtext); margin-top:4px;">${new Date(t.create_time).toLocaleString()}</div>
            </div>
            <div style="text-align:right;">
                <div class="${colorClass}" style="font-size:16px;">${symbol} ¥${Math.abs(t.amount).toFixed(2)}</div>
                <div style="font-size:12px; color:var(--anzhiyu-secondtext); margin-top:4px;">余额: ¥${parseFloat(t.balance_after).toFixed(2)}</div>
            </div>
        </div>`;
}

async function loadRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    try {
        const res = await fetch(`/api/transactions/${currentCardNumber}`);
        const data = await res.json();

        if (data.status === 'success' && data.transactions && data.transactions.length > 0) {
            container.innerHTML = '';
            data.transactions.slice(0, 5).forEach(t => {
                container.insertAdjacentHTML('beforeend', renderTransactionItem(t));
            });
        } else {
            container.innerHTML = '<div style="text-align:center; color:var(--anzhiyu-secondtext); padding:20px;">暂无交易记录</div>';
        }
    } catch(e) { container.innerHTML = '加载失败'; }
}

async function showTransactionHistory() {
    const modal = document.getElementById('historyModal');
    const container = document.getElementById('transactionsTableBody');
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--anzhiyu-secondtext);">加载中...</div>';

    try {
        const res = await fetch(`/api/transactions/${currentCardNumber}`);
        const data = await res.json();

        if (data.status === 'success' && data.transactions && data.transactions.length > 0) {
            container.innerHTML = '';
            data.transactions.forEach(t => {
                container.insertAdjacentHTML('beforeend', renderTransactionItem(t));
            });
        } else {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--anzhiyu-secondtext);">暂无交易记录</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--danger);">数据加载失败</div>';
    }
}
function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }


// === 消息系统 ===
async function loadMessages() {
    try {
        const res = await fetch(`/api/messages/${currentCardNumber}`);
        const data = await res.json();
        if (data.status === 'success') {
            currentMessages = data.messages;
            updateMessageBadge();
            checkNewTransferAlert();
        }
    } catch(e) {}
}

function updateMessageBadge() {
    const unread = currentMessages.filter(m => m.is_read === 0).length;
    const badge = document.getElementById('msgBadge');
    if(badge) badge.style.display = unread > 0 ? 'block' : 'none';
}

function checkNewTransferAlert() {
    const hasShown = sessionStorage.getItem('hasShownAlert');
    const unreadTransfers = currentMessages.filter(m => m.is_read === 0 && m.type === 'transfer');
    if (unreadTransfers.length > 0 && !hasShown) {
        setTimeout(() => {
            openMessageDetail(unreadTransfers[0].id);
            sessionStorage.setItem('hasShownAlert', 'true');
        }, 1000);
    }
}

function showMessagesModal() {
    const list = document.getElementById('messageList');
    document.getElementById('messagesModal').style.display = 'flex';
    list.innerHTML = '';
    if (currentMessages.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:30px; color:#888;">暂无消息</div>';
    } else {
        currentMessages.forEach(msg => {
            const isRead = msg.is_read === 1;
            const icon = msg.type === 'transfer' ? '<i class="fas fa-coins"></i>' : '<i class="fas fa-bell"></i>';
            const title = msg.type === 'transfer' ? '收到转账' : '系统通知';

            const html = `
                <div class="msg-item ${isRead?'':'unread'}" onclick="openMessageDetail(${msg.id})">
                    <div class="msg-icon">${icon}</div>
                    <div class="msg-content">
                        <div class="msg-title">${title}</div>
                        <div class="msg-preview">${msg.content}</div>
                    </div>
                    ${!isRead ? '<div class="badge-dot" style="position:relative; display:block;"></div>' : ''}
                    <div class="msg-time">${new Date(msg.create_time).toLocaleDateString()}</div>
                </div>`;
            list.insertAdjacentHTML('beforeend', html);
        });
    }
}
function closeMessagesModal() { document.getElementById('messagesModal').style.display = 'none'; }

async function openMessageDetail(id) {
    const msg = currentMessages.find(m => m.id === id);
    if(!msg) return;

    if (msg.is_read === 0) {
        msg.is_read = 1;
        updateMessageBadge();
        if(document.getElementById('messagesModal').style.display === 'flex') showMessagesModal();
        fetch('/api/messages/read', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id}) });
    }

    const box = document.getElementById('msgDetailContentBox');
    const iconBox = document.getElementById('msgIconType');
    const title = document.getElementById('detailTitle');

    let contentHtml = '';

    if (msg.type === 'transfer') {
        title.innerText = '收到转账通知';
        iconBox.style.background = 'rgba(16,185,129,0.1)';
        iconBox.style.color = 'var(--success)';
        iconBox.innerHTML = '<i class="fas fa-coins" style="font-size: 24px;"></i>';

        const amount = parseFloat(msg.amount).toFixed(2);

        contentHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="confirm-label">转账金额</span>
                <div style="font-size:24px; color:var(--success); font-weight:bold; display:flex; align-items:center; gap:10px;">
                    <span id="detailMsgAmount">****</span>
                    <i class="fas fa-eye-slash" onclick="toggleMsgAmount(this, '${amount}')" style="font-size:16px; cursor:pointer; color:var(--anzhiyu-secondtext);"></i>
                </div>
            </div>
            <div style="height:1px; background:var(--border-color); margin:10px 0;"></div>
            <div class="confirm-row"><span class="confirm-label">付款人</span><span class="confirm-value">${msg.sender_name}</span></div>
            <div class="confirm-row"><span class="confirm-label">时间</span><span class="confirm-value" style="font-size:12px;">${new Date(msg.create_time).toLocaleString()}</span></div>
            <div class="confirm-row"><span class="confirm-label">留言</span><span class="confirm-value" style="font-weight:normal; max-width:60%;">${msg.content || '无'}</span></div>
        `;
    } else {
        title.innerText = '系统通知';
        iconBox.style.background = 'rgba(59,130,246,0.1)';
        iconBox.style.color = 'var(--anzhiyu-theme)';
        iconBox.innerHTML = '<i class="fas fa-bell" style="font-size: 24px;"></i>';

        contentHtml = `
            <div style="font-size:14px; line-height:1.6; color:var(--anzhiyu-fontcolor);">
                ${msg.content}
            </div>
            <div style="margin-top:15px; font-size:12px; color:var(--anzhiyu-secondtext); text-align:right;">
                ${new Date(msg.create_time).toLocaleString()}
            </div>
        `;
    }

    box.innerHTML = contentHtml;
    document.getElementById('msgDetailModal').style.display = 'flex';
}

window.toggleMsgAmount = function(icon, realAmount) {
    const el = document.getElementById('detailMsgAmount');
    if (el.innerText === '****') {
        el.innerText = '¥ ' + realAmount;
        icon.className = 'fas fa-eye';
        icon.style.color = 'var(--anzhiyu-theme)';
    } else {
        el.innerText = '****';
        icon.className = 'fas fa-eye-slash';
        icon.style.color = 'var(--anzhiyu-secondtext)';
    }
}

function closeMsgDetail() { document.getElementById('msgDetailModal').style.display = 'none'; }

// === 转账逻辑 ===
function showTransferModal() {
    document.getElementById('transferModal').style.display = 'flex';
    resetTransferForm();
}
function closeTransferModal() { document.getElementById('transferModal').style.display = 'none'; }

function resetTransferForm() {
    document.getElementById('transferToCard').value = '';
    document.getElementById('transferNameDisplay').style.display = 'none';
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferMsg').value = '';
    document.getElementById('isAnonymous').checked = false;
    toggleAnon();
}

function toggleAnon() {
    const cb = document.getElementById('isAnonymous');
    const icon = document.getElementById('anonIcon');
    cb.checked = !cb.checked;
    icon.className = cb.checked ? 'far fa-check-square' : 'far fa-square';
    icon.style.color = cb.checked ? 'var(--anzhiyu-theme)' : 'var(--anzhiyu-secondtext)';
}

async function queryTransferName() {
    const card = document.getElementById('transferToCard').value;
    if (!card) return showMessage('请输入卡号', 'error');
    if (card === currentCardNumber) return showMessage('不能转账给自己', 'error');
    try {
        const res = await fetch(`/api/user/name/${card}`);
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('transferToName').innerText = data.name;
            document.getElementById('transferNameDisplay').style.display = 'block';
        } else { showMessage('卡号不存在', 'error'); }
    } catch (e) { showMessage('查询失败', 'error'); }
}

function confirmTransferStep() {
    const amount = document.getElementById('transferAmount').value;
    if (document.getElementById('transferNameDisplay').style.display === 'none') return showMessage('请先查询收款人', 'error');
    if (!amount || amount <= 0) return showMessage('请输入有效金额', 'error');

    document.getElementById('confirmName').innerText = document.getElementById('transferToName').innerText;
    document.getElementById('confirmCard').innerText = document.getElementById('transferToCard').value;
    document.getElementById('confirmAmount').innerText = '¥ ' + parseFloat(amount).toFixed(2);

    closeTransferModal();
    document.getElementById('transferConfirmModal').style.display = 'flex';
}

function closeTransferConfirm() {
    document.getElementById('transferConfirmModal').style.display = 'none';
    document.getElementById('transferModal').style.display = 'flex';
}

async function submitTransfer() {
    const data = {
        from_card: currentCardNumber,
        to_card: document.getElementById('transferToCard').value,
        amount: parseFloat(document.getElementById('transferAmount').value),
        message: document.getElementById('transferMsg').value,
        is_anonymous: document.getElementById('isAnonymous').checked
    };

    document.getElementById('transferConfirmModal').style.display = 'none';

    try {
        const res = await fetch('/api/transfer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        const ret = await res.json();
        if(ret.status === 'success') {
            showMessage('转账成功！', 'success');
            loadBalance();
            loadRecentTransactions();
        } else {
            showMessage(ret.message, 'error');
        }
    } catch(e) { showMessage('网络错误', 'error'); }
}

// === 通用弹窗逻辑 ===
function showDepositModal() { document.getElementById('depositModal').style.display = 'flex'; document.getElementById('depositAmount').value = ''; }
function closeDepositModal() { document.getElementById('depositModal').style.display = 'none'; }
async function processDeposit() {
    const amt = document.getElementById('depositAmount').value;
    await doTrans('/api/deposit', { card_number: currentCardNumber, amount: parseFloat(amt) });
    closeDepositModal();
}
function showWithdrawModal() { document.getElementById('withdrawModal').style.display = 'flex'; document.getElementById('withdrawAmount').value = ''; }
function closeWithdrawModal() { document.getElementById('withdrawModal').style.display = 'none'; }
async function processWithdraw() {
    const amt = document.getElementById('withdrawAmount').value;
    await doTrans('/api/withdraw', { card_number: currentCardNumber, amount: parseFloat(amt) });
    closeWithdrawModal();
}
async function doTrans(url, data) {
    try {
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        const ret = await res.json();
        showMessage(ret.message, ret.status==='success'?'success':'error');
        if(ret.status === 'success') { loadBalance(); loadRecentTransactions(); }
    } catch(e) { showMessage('网络错误', 'error'); }
}

function logout() { showLogoutModal(); }
function showLogoutModal() { document.getElementById('logoutModal').style.display = 'flex'; }
function closeLogoutModal() { document.getElementById('logoutModal').style.display = 'none'; }
function confirmLogout() { sessionStorage.clear(); window.location.href = '/'; }
function showAccountInfo() { window.location.href = '/profile.html'; }

function showMessage(msg, type) {
    const el = document.getElementById('message');
    if(!el) return;
    el.textContent = msg;
    el.className = `snackbar ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal-wrap')) {
        event.target.style.display = 'none';
    }
}