const fs = require('fs');
const hrFile = 'docs/feature-audit/raw/hr.md';
let content = fs.readFileSync(hrFile, 'utf8');

const lines = content.split('\n');
let inAttendance = false;

for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('### حضور و غیاب')) {
        inAttendance = true;
    }
    if (inAttendance && lines[i].startsWith('### ')) {
        if (!lines[i].includes('حضور و غیاب')) {
            inAttendance = false;
        }
    }
    
    if (inAttendance) {
        if (lines[i].startsWith('- **زاویه فروش**:')) {
            lines[i] = '- **زاویه فروش**: مدیریت یکپارچه ورود و خروج کارکنان و محاسبه‌ی خودکار کارکرد آن‌ها بدون نیاز به محاسبه دستی.';
        }
        if (lines[i].startsWith('- **نحوه استفاده (مسیر واقعی UI)**:')) {
            lines[i] = lines[i].replace(/و اتصال به دستگاه‌های فیزیکی /g, '');
        }
        if (lines[i].startsWith('- **Evidence**:')) {
            lines[i] = '- **Evidence**: منطق محاسبه شیفت در `attendanceFor`، جداول دیتابیس در `attendance-01-migration.sql` (بدون پیاده‌سازی واقعی آداپتورهای فیزیکی).';
        }
        if (lines[i].startsWith('- **توضیحات**:')) {
            lines[i] = '- **توضیحات**: ثبت ساعات ورود و خروج پرسنل و محاسبه‌ی دقیق کارکرد بر اساس شیفت‌های کاری تعریف شده.';
        }
    }
}

fs.writeFileSync(hrFile, lines.join('\n'));
console.log("Done");
