const ICal = require('ical-generator').default;
const moment = require('moment');

// 辅助函数：处理"24:00"时间，确保日历事件在指定日期的末尾
const parseICalDateTime = (dateString) => {
    if (dateString.includes('24:00')) {
        // 将 'YYYY-MM-DD 24:00' 转换为 'YYYY-MM-DD 23:59:59'
        return moment(dateString.replace('24:00', '23:59:59'));
    }
    // 对于其他标准格式，直接解析
    return moment(dateString);
};

// generateCalendar 现在接收一个未来日期的数组和最新的油价信息
function generateCalendar(futureDates, latestOilInfo) {
    const calendar = new ICal({
        name: '油价调整日历',
        timezone: 'Asia/Shanghai'
    });

    if (futureDates.length === 0) {
        // 如果没有未来的调整日期，创建一个提示性事件
        calendar.createEvent({
            start: parseICalDateTime(moment().format('YYYY-MM-DD HH:MM')),
            end: parseICalDateTime(moment().add(1, 'hour').format('YYYY-MM-DD HH:MM')),
            summary: '油价调整信息：暂无即将调整的油价信息',
            description: '目前没有预期的油价调整信息。\n您可以关注本页面获取最新油价信息。\n链接：https://example.com/oil-price',
            url: 'https://example.com/oil-price',
            categories: [{ name: '油价调整' }]
        });
    } else {
        futureDates.forEach((dateEntry, index) => {
            let summary;
            let description;
            let eventStart;
            let eventEnd;

            if (index === 0 && latestOilInfo.lastTrend) {
                // 第一个事件（最近的未来调整），使用详细的预期信息
                const trendText = latestOilInfo.lastTrend === 'up' ? '上涨' : '下跌';
                const adjustmentExpected = `${trendText} ${latestOilInfo.lastAmount || 0}元`;

                summary = `油价调整预期：${adjustmentExpected}`;
                description = `调整预期：${adjustmentExpected}\n时间：${latestOilInfo.lastUpdate}`; // 描述中保留原始的 24:00

                // 使用 parseICalDateTime 来设置日历事件的实际时间
                eventStart = parseICalDateTime(latestOilInfo.lastUpdate);
                eventEnd = parseICalDateTime(latestOilInfo.lastUpdate).add(1, 'hour');

            } else {
                // 后续事件（待预测）
                summary = `油价调整预期：待预测 (时间：${dateEntry.date} 24:00)`; // 摘要中明确 24:00
                description = `调整预期：待预测\n调整日期：${dateEntry.date} 24:00`; // 描述中明确 24:00
                
                // 对于后续日期，我们假设它们也是在 24:00 调整，并使用 parseICalDateTime
                eventStart = parseICalDateTime(`${dateEntry.date} 24:00`);
                eventEnd = parseICalDateTime(`${dateEntry.date} 24:00`).add(1, 'hour');
            }

            calendar.createEvent({
                start: eventStart,
                end: eventEnd,
                summary: summary,
                description: description,
                url: 'https://example.com/oil-price',
                categories: [{ name: '油价调整' }]
            });
        });
    }

    return calendar;
}

module.exports = {
    generateCalendar
}; 