let currentCardNumber = '';
let realBalance = 0;
let isBalanceHidden = true;
let snackbarTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    currentCardNumber = sessionStorage.getItem('cardNumber');
    if (!currentCardNumber) { window.location.href = '/'; return; }
    loadProfile();
});

async function loadProfile() {
    try {
        const response = await fetch(`/api/userinfo/${currentCardNumber}`);
        const data = await response.json();
        if (data.status === 'success') {
            setInput('infoName', data.name);
            setInput('infoIdCard', data.id_card);
            setInput('infoPhone', data.phone);
            setInput('infoAddress', data.address || '未填写');
            setInput('infoCardNumber', data.card_number);
            realBalance = parseFloat(data.balance).toFixed(2);
            updateBalanceDisplay();
            setInput('infoDate', new Date(data.create_time).toLocaleString());
        } else { showMessage('加载失败', 'error'); }
    } catch (e) { showMessage('网络错误', 'error'); }
}

function setInput(id, value) {
    const el = document.getElementById(id);
    if(el) el.value = value;
}

function toggleProfileBalance() {
    isBalanceHidden = !isBalanceHidden;
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const el = document.getElementById('infoBalance');
    const icon = document.getElementById('eyeIcon');
    if (isBalanceHidden) {
        el.value = '****';
        icon.className = 'fas fa-eye-slash';
        icon.style.color = 'var(--anzhiyu-secondtext)';
    } else {
        el.value = '¥ ' + realBalance;
        icon.className = 'fas fa-eye';
        icon.style.color = 'var(--anzhiyu-theme)';
    }
}

// === 编辑弹窗逻辑 ===

function showEditModal() {
    // 1. 将当前显示的信息填充到弹窗中
    document.getElementById('editName').value = document.getElementById('infoName').value;
    document.getElementById('editIdCard').value = document.getElementById('infoIdCard').value;
    document.getElementById('editPhone').value = document.getElementById('infoPhone').value;
    document.getElementById('editAddress').value = document.getElementById('infoAddress').value;

    // 2. 显示弹窗
    document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

async function submitEdit() {
    const name = document.getElementById('editName').value.trim();
    const idCard = document.getElementById('editIdCard').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const address = document.getElementById('editAddress').value.trim();

    // === 校验逻辑 ===
    if (!name || !idCard || !phone) {
        return showMessage('请填写完整的必填项', 'error');
    }

    // 校验身份证：18位，最后一位可以是数字或X
    const idCardRegex = /^[0-9]{17}[0-9Xx]$/;
    if (!idCardRegex.test(idCard)) {
        return showMessage('身份证号码必须是18位', 'error');
    }

    // 校验手机号：11位纯数字
    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(phone)) {
        return showMessage('手机号码必须是11位数字', 'error');
    }

    // === 发送请求 ===
    const data = {
        card_number: currentCardNumber,
        name: name,
        id_card: idCard,
        phone: phone,
        address: address
    };
    try {
        const res = await fetch('/api/user/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        const ret = await res.json();
        showMessage(ret.status==='success'?'保存成功':'保存失败', ret.status==='success'?'success':'error');
    } catch (e) { showMessage('网络错误', 'error'); }
}

// === 修改密码 ===
function showChangePwdModal() {
    document.getElementById('changePwdModal').style.display = 'flex';
    document.getElementById('oldPwd').value = '';
    document.getElementById('newPwd').value = '';
    document.getElementById('confirmPwd').value = '';
}
function closeChangePwdModal() { document.getElementById('changePwdModal').style.display = 'none'; }

async function submitChangePwd() {
    const oldP = document.getElementById('oldPwd').value;
    const newP = document.getElementById('newPwd').value;
    const cP = document.getElementById('confirmPwd').value;

    if(!oldP || !newP) return showMessage('请输入密码', 'error');
    if(newP !== cP) return showMessage('两次新密码不一致', 'error');

    try {
        const res = await fetch('/api/password/change', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ card_number: currentCardNumber, old_password: oldP, new_password: newP })
        });
        const ret = await res.json();

        if (ret.status === 'success') {
            showMessage('资料修改成功', 'success');
            closeEditModal();
            loadProfile(); // 重新加载并显示最新信息
        } else {
            showMessage(ret.message || '资料信息未修改', 'error');
        }
    } catch (e) { showMessage('保存失败', 'error'); }
}

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

window.onclick = function(event) {
    if (event.target.id === 'changePwdModal') closeChangePwdModal();
}