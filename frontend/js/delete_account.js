let deleteTimer = null;

// 验证并显示确认框
async function verifyAndDelete() {
    const card = document.getElementById('delCard').value;
    const name = document.getElementById('delName').value;
    const phone = document.getElementById('delPhone').value;

    if(!card || !name || !phone) return showMessage('请填写所有信息', 'error');

    try {
        // 1. 请求后端验证并获取余额
        const res = await fetch('/api/account/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_number: card, name: name, phone: phone })
        });
        const data = await res.json();

        if (data.status === 'success') {
            // 2. 验证通过，显示弹窗
            showConfirmModal(card, name, data.balance);
        } else {
            showMessage('验证失败：信息不匹配', 'error');
        }
    } catch (e) { showMessage('网络错误', 'error'); }
}

function showConfirmModal(card, name, balance) {
    const modal = document.getElementById('confirmDeleteModal');
    const btn = document.getElementById('finalDeleteBtn');
    const warning = document.getElementById('balanceWarning');

    // 填充信息
    document.getElementById('confirmCardNum').innerText = card;
    document.getElementById('confirmNameVal').innerText = name;

    // 余额警告
    if (balance > 0) {
        warning.style.display = 'block';
        document.getElementById('delBalanceVal').innerText = '¥ ' + parseFloat(balance).toFixed(2);
    } else {
        warning.style.display = 'none';
    }

    modal.style.display = 'flex';

    // 5秒倒计时逻辑
    let count = 5;
    btn.disabled = true;
    btn.style.background = 'var(--anzhiyu-secondtext)';
    btn.innerText = `确定 (${count})`;

    if (deleteTimer) clearInterval(deleteTimer);
    deleteTimer = setInterval(() => {
        count--;
        if (count > 0) {
            btn.innerText = `确定 (${count})`;
        } else {
            clearInterval(deleteTimer);
            btn.disabled = false;
            btn.style.background = 'var(--danger)';
            btn.innerText = '确定注销';
            btn.onclick = executeDelete; // 绑定最终删除事件
        }
    }, 1000);
}

function closeConfirmModal() {
    document.getElementById('confirmDeleteModal').style.display = 'none';
    if (deleteTimer) clearInterval(deleteTimer);
}

// 执行真正的删除
async function executeDelete() {
    const card = sessionStorage.getItem('cardNumber');
    try {
        const res = await fetch('/api/account/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_number: card })
        });
        const data = await res.json();

        if (data.status === 'success') {
            alert('账户已成功注销，即将返回登录页');
            sessionStorage.clear();
            window.location.href = '/';
        } else {
            showMessage('注销失败，请联系管理员', 'error');
            closeConfirmModal();
        }
    } catch (e) { showMessage('网络错误', 'error'); }
}

// 消息提示工具 (复用)
let snackbarTimer = null;
function showMessage(msg, type) {
    const oldEl = document.getElementById('message');
    if(!oldEl) return;
    if (snackbarTimer) { clearTimeout(snackbarTimer); snackbarTimer = null; }
    const newEl = oldEl.cloneNode(false);
    oldEl.parentNode.replaceChild(newEl, oldEl);
    newEl.textContent = msg;
    newEl.className = `snackbar ${type}`;
    newEl.style.display = 'block';
    snackbarTimer = setTimeout(() => {
        newEl.classList.add('hide');
        newEl.addEventListener('animationend', () => { if(newEl.classList.contains('hide')) newEl.style.display = 'none'; }, {once:true});
    }, 3000);
}