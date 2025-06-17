const ICal = require('ical-generator').default;
const moment = require('moment');

// generateCalendar 现在接收一个未来日期的数组和最新的油价信息
function generateCalendar(futureDates, latestOilInfo) {
    const calendar = new ICal({
        name: '油价调整日历',
        timezone: 'Asia/Shanghai'
    });

    // 函数：处理时间字符串，将"24:00"转换为"23:59"
    const adjustTime = (dateString) => {
        if (dateString && dateString.includes('24:00')) {
             return moment(dateString.replace('24:00', '23:59'));
        }
        return moment(dateString);
    };

    if (futureDates.length === 0) {
        // 如果没有未来的调整日期，创建一个提示性事件
        calendar.createEvent({
            start: adjustTime(moment().format('YYYY-MM-DD HH:MM')),
            end: adjustTime(moment().add(1, 'hour').format('YYYY-MM-DD HH:MM')),
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
                description = `调整预期：${adjustmentExpected}\n时间：${latestOilInfo.lastUpdate}`; // 加上精确时间
                
                // 使用 latestOilInfo.lastUpdate 作为精确的事件时间
                eventStart = adjustTime(latestOilInfo.lastUpdate);
                eventEnd = adjustTime(latestOilInfo.lastUpdate).add(1, 'hour');

            } else {
                // 后续事件，显示"待预测"
                summary = `油价调整预期：待预测 (时间：${dateEntry.date})`; // 摘要也包含日期
                description = `调整预期：待预测\n调整日期：${dateEntry.date}`; // 描述中包含日期
                
                // 对于后续事件，使用其日期作为事件的开始时间 (默认为当天00:00)
                // 结束时间设置为开始后一小时
                eventStart = adjustTime(dateEntry.date);
                eventEnd = adjustTime(dateEntry.date).add(1, 'hour');
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