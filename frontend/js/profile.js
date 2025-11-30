document.addEventListener('DOMContentLoaded', function() {
    // 1. 检查登录状态
    const cardNumber = sessionStorage.getItem('cardNumber');
    if (!cardNumber) {
        window.location.href = '/'; // 未登录则回首页
        return;
    }

    // 2. 加载数据
    loadProfile(cardNumber);
});

async function loadProfile(cardNumber) {
    try {
        const response = await fetch(`/api/userinfo/${cardNumber}`);
        const data = await response.json();

        if (data.status === 'success') {
            // 填充基本信息
            setInput('infoName', data.name);
            setInput('infoIdCard', data.id_card);
            setInput('infoPhone', data.phone);
            setInput('infoAddress', data.address || '未填写');

            // 填充账户信息
            setInput('infoCardNumber', data.card_number);
            setInput('infoBalance', `¥ ${parseFloat(data.balance).toFixed(2)}`);

            // 格式化时间
            const date = new Date(data.create_time);
            setInput('infoDate', date.toLocaleString('zh-CN', { hour12: false }));

        } else {
            showMessage(data.message || '获取信息失败', 'error');
        }
    } catch (error) {
        console.error(error);
        showMessage('网络连接错误', 'error');
    }
}

function setInput(id, value) {
    const el = document.getElementById(id);
    if(el) el.value = value;
}

function showMessage(msg, type) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.className = `snackbar ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}