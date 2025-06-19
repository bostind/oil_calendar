const ICal = require('ical-generator').default;
const moment = require('moment-timezone');

// 辅助函数：处理"24:00"时间，确保日历事件在指定日期的末尾，且带时区
const parseICalDateTime = (dateString) => {
    if (dateString.includes('24:00')) {
        // 将 'YYYY-MM-DD 24:00' 转换为 'YYYY-MM-DD 16:00:00'，并指定东八区
        return moment.tz(dateString.replace('24:00', '16:00:00'), 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
    }
    // 对于其他标准格式，直接解析为东八区
    return moment.tz(dateString, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
};

// 新增：趋势转中文
function getTrendText(trend) {
    if (trend === 'up') return '上涨';
    if (trend === 'down') return '下跌';
    if (trend === 'stranded') return '搁浅';
    return trend || '待预测';
}

// generateCalendar 现在接收一个未来日期的数组和最新的油价信息
function generateCalendar(futureDates, latestOilInfo) {
    const calendar = new ICal({
        name: '油价调整日历',
        timezone: 'Asia/Shanghai'
    });

    if (futureDates.length === 0) {
        // 如果没有未来的调整日期，创建一个提示性事件
        calendar.createEvent({
            start: parseICalDateTime(moment().format('YYYY-MM-DD HH:mm:ss')),
            end: parseICalDateTime(moment().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss')),
            summary: '油价调整信息：暂无即将调整的油价信息',
            description: '目前没有预期的油价调整信息。\n您可以关注本页面获取最新油价信息。\n链接：https://example.com/oil-price',
            url: 'https://example.com/oil-price',
            categories: [{ name: '油价调整' }],
            timezone: 'Asia/Shanghai'
        });
    } else {
        futureDates.forEach((dateEntry, index) => {
            let summary;
            let description;
            // 只保留原始字段
            const dateOrigin = dateEntry.date;

            if (index === 0 && latestOilInfo.lastTrend) {
                // 第一个事件描述包含最新趋势和新闻
                const trendText = getTrendText(latestOilInfo.lastTrend);
                const adjustmentExpected = `${trendText}${latestOilInfo.lastAmount ? ' ' + latestOilInfo.lastAmount : ''}`;
                summary = `油价调整预期：${adjustmentExpected}`;
                description = `调整预期：${adjustmentExpected}\n调整日期：${dateOrigin}`;
                if (latestOilInfo.lastNews) {
                    description += `\n新闻摘要：${latestOilInfo.lastNews}`;
                }
                if (latestOilInfo.lastNewsUrl) {
                    description += `\n新闻链接：${latestOilInfo.lastNewsUrl}`;
                }
            } else {
                summary = `油价调整预期：待预测 (时间：${dateOrigin})`;
                description = `调整预期：待预测\n调整日期：${dateOrigin}`;
            }

            calendar.createEvent({
                start: parseICalDateTime(`${dateOrigin} 16:00:00`),
                end: parseICalDateTime(`${dateOrigin} 16:00:00`).add(1, 'hour'),
                summary,
                description,
                url: 'https://example.com/oil-price',
                categories: [{ name: '油价调整' }],
                timezone: 'Asia/Shanghai'
            });
        });
    }

    return calendar;
}

module.exports = {
    generateCalendar
}; 