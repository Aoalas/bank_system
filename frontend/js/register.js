// 全局变量
let isCardAvailable = false;

// 页面加载初始化
document.addEventListener('DOMContentLoaded', function() {
    // 绑定表单提交事件
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // 绑定卡号检查事件
    document.getElementById('checkCardBtn').addEventListener('click', checkCardAvailability);

    // 实时检查密码匹配
    document.getElementById('confirm_password').addEventListener('input', checkPasswordMatch);
});

// 检查卡号可用性
async function checkCardAvailability() {
    const cardNumber = document.getElementById('card_number').value.trim();
    const checkBtn = document.getElementById('checkCardBtn');
    const availabilityDiv = document.getElementById('cardAvailability');

    if (!cardNumber) {
        showMessage('请输入卡号', 'error');
        return;
    }

    if (cardNumber.length < 16 || cardNumber.length > 19) {
        showMessage('卡号长度不足,不可小于16位且大于19位', 'error');
        return;
    }
    else{
        showMessage('卡号可用', 'success');
    }

    try {
        checkBtn.disabled = true;
        checkBtn.textContent = '检查中...';

        const response = await fetch(`/api/check-card/${cardNumber}`);
        const data = await response.json();

        if (data.status === 'success') {
            isCardAvailable = data.available;

            if (data.available) {
                availabilityDiv.innerHTML = '<span class="available">✅ 卡号可用</span>';
            } else {
                availabilityDiv.innerHTML = '<span class="unavailable">❌ 卡号已存在</span>';
            }
        } else {
            showMessage('检查卡号失败: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('检查卡号错误:', error);
        showMessage('网络错误，请重试', 'error');
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = '检查可用性';
    }
}

// 检查密码匹配
function checkPasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const confirmInput = document.getElementById('confirm_password');

    if (confirmPassword && password !== confirmPassword) {
        confirmInput.style.borderColor = '#dc3545';
    } else if (confirmPassword) {
        confirmInput.style.borderColor = '#28a745';
    } else {
        confirmInput.style.borderColor = '#ddd';
    }
}

// 处理注册表单提交
async function handleRegister(event) {
    event.preventDefault();

    // 获取表单数据
    const formData = {
        name: document.getElementById('name').value.trim(),
        id_card: document.getElementById('id_card').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        card_number: document.getElementById('card_number').value.trim(),
        password: document.getElementById('password').value,
        initial_deposit: parseFloat(document.getElementById('initial_deposit').value)
    };

    // 前端验证
    if (!validateForm(formData)) {
        return;
    }

    // 检查卡号是否已验证
    if (!isCardAvailable) {
        showMessage('请先检查卡号可用性', 'error');
        return;
    }

    // 检查密码匹配
    if (formData.password !== document.getElementById('confirm_password').value) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }

    // 提交注册
    await submitRegistration(formData);
}

// 表单验证
function validateForm(data) {
    if (!data.name) {
        showMessage('请输入姓名', 'error');
        return false;
    }

    if (!data.id_card || data.id_card.length !== 18) {
        showMessage('请输入有效的18位身份证号', 'error');
        return false;
    }

    if (!data.phone || data.phone.length !== 11) {
        showMessage('请输入有效的11位手机号码', 'error');
        return false;
    }

    if (!data.card_number || data.card_number.length < 16) {
        showMessage('请输入有效的卡号', 'error');
        return false;
    }

    if (!data.password || data.password.length < 6) {
        showMessage('密码至少6位', 'error');
        return false;
    }

    if (data.initial_deposit < 0) {
        showMessage('存款金额不能为负数', 'error');
        return false;
    }

    return true;
}

// 提交注册
async function submitRegistration(formData) {
    const submitBtn = document.getElementById('submitBtn');

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '开户中...';

        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.status === 'success') {
            showMessage(`开户成功！您的卡号是: ${result.card_number}`, 'success');

            // 3秒后跳转到登录页面
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } else {
            showMessage('开户失败: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showMessage('网络错误，请重试', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '立即开户';
    }
}

// 显示消息
function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
}

// 返回登录页面
function goToLogin() {
    window.location.href = '/';
}

// 卡号输入时重置可用性状态
document.getElementById('card_number').addEventListener('input', function() {
    isCardAvailable = false;
    document.getElementById('cardAvailability').innerHTML = '';
});