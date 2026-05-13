document.addEventListener('DOMContentLoaded', () => {
    const stepIndicators = document.querySelectorAll('.step-dot');
    const steps = ['step1', 'step2', 'step3', 'step4'];
    let currentStep = 0;
    const apiBaseUrl = `${window.TatakApi?.API_BASE_URL || 'https://tatak-form.onrender.com'}/auth`;

    const studentIdInput = document.getElementById('resetId');
    const studentIdPreview = document.getElementById('studentIdPreview');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const codeInputs = Array.from(document.querySelectorAll('.code-digit'));
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const toggleButtons = document.querySelectorAll('.toggle-pw');
    let resetToken = '';

    function showStep(index) {
        currentStep = index;
        steps.forEach((stepId, i) => {
            const stepEl = document.getElementById(stepId);
            stepEl.classList.toggle('hidden', i !== index);
            stepIndicators[i].classList.toggle('active', i === index);
        });
    }

    function formatIdentifierValue(value) {
        return value.trim() || '---';
    }

    async function requestResetCode(advance = true) {
        const identifier = studentIdInput.value.trim();
        if (!identifier) {
            studentIdInput.focus();
            return false;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: identifier })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                window.TatakApi.showToast(errorData.error || 'Unable to send verification code.', 'error');
                return false;
            }

            studentIdPreview.textContent = formatIdentifierValue(identifier);
            if (advance) {
                showStep(1);
                codeInputs[0].focus();
                window.TatakApi.showToast('Verification code sent to your registered email.', 'success');
            }
            return true;
        } catch (error) {
            console.error('Forgot password error:', error);
            window.TatakApi.showToast('Unable to connect to the server. Please try again.', 'error');
            return false;
        }
    }

    sendCodeBtn.addEventListener('click', () => {
        requestResetCode(true);
    });

    verifyCodeBtn.addEventListener('click', async () => {
        const code = codeInputs.map(i => i.value.trim()).join('');
        if (code.length < 6) {
            codeInputs[0].focus();
            window.TatakApi.showToast('Please enter the full 6-digit code.', 'error');
            return;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: code })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                window.TatakApi.showToast(errorData.error || 'Invalid or expired code.', 'error');
                return;
            }

            resetToken = code;
            showStep(2);
            document.getElementById('newPassword').focus();
            window.TatakApi.showToast('Code verified! Please set your new password.', 'success');
        } catch (error) {
            console.error('Verify token error:', error);
            window.TatakApi.showToast('Unable to verify code. Please try again.', 'error');
        }
    });

    resetPasswordBtn.addEventListener('click', async () => {
        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        if (newPassword.length < 8) {
            window.TatakApi.showToast('Password must be at least 8 characters long.', 'error');
            document.getElementById('newPassword').focus();
            return;
        }

        if (newPassword !== confirmPassword) {
            window.TatakApi.showToast('Passwords do not match.', 'error');
            document.getElementById('confirmPassword').focus();
            return;
        }

        if (!resetToken) {
            window.TatakApi.showToast('Please enter the verification code first.', 'error');
            showStep(1);
            return;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, newPassword })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                window.TatakApi.showToast(errorData.error || 'Unable to reset password.', 'error');
                return;
            }

            window.TatakApi.showToast('Password reset successful! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            showStep(3);
        } catch (error) {
            console.error('Reset password error:', error);
            window.TatakApi.showToast('Unable to connect to the server. Please try again.', 'error');
        }
    });

    resendCodeBtn.addEventListener('click', async () => {
        const success = await requestResetCode(false);
        if (!success) return;

        resendCodeBtn.disabled = true;
        let countdown = 40;
        resendCodeBtn.textContent = `Resend Code (${countdown}s)`;

        const interval = setInterval(() => {
            countdown -= 1;
            resendCodeBtn.textContent = `Resend Code (${countdown}s)`;
            if (countdown <= 0) {
                clearInterval(interval);
                resendCodeBtn.disabled = false;
                resendCodeBtn.innerHTML = 'Resend Code <span>(40s)</span>';
            }
        }, 1000);
    });

    codeInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            const value = input.value.replace(/[^0-9]/g, '');
            input.value = value;
            if (value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && !input.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
    });

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const target = document.getElementById(targetId);
            if (!target) return;
            const type = target.getAttribute('type') === 'password' ? 'text' : 'password';
            target.setAttribute('type', type);
            button.querySelector('i').classList.toggle('fa-eye');
            button.querySelector('i').classList.toggle('fa-eye-slash');
        });
    });

    showStep(0);
});
