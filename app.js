const express = require('express');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const schedule = require('node-schedule');
const { generateCalendar } = require('./utils/calendar');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 6067;

// Python 后端服务的URL
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';

// 中间件设置
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// 读取油价调整时间表
const getOilPriceData = () => {
    return JSON.parse(fs.readFileSync('tzrq.json', 'utf8'));
};

// 读取搜索结果
const getSearchResults = () => {
    try {
        return JSON.parse(fs.readFileSync('search_results.json', 'utf8'));
    } catch (error) {
        return {
            lastUpdate: null,
            lastTrend: null,
            lastAmount: null,
            lastTypes: [],
            lastSource: null,
            lastNews: null,
            lastNewsUrl: null,
            manualTrend: null,
            manualAmount: null,
            manualUpdate: null,
            newsHistory: []
        };
    }
};

// 保存搜索结果
const saveSearchResults = (data) => {
    fs.writeFileSync('search_results.json', JSON.stringify(data, null, 4));
};

// 用户订阅数据存储
const subscribers = new Map();

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 管理界面路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 获取油价调整时间表和最新信息
app.get('/api/dates', (req, res) => {
    const oilPriceData = getOilPriceData();
    const searchResults = getSearchResults();
    res.json({
        ...oilPriceData,
        ...searchResults
    });
});

// 订阅日历
app.post('/api/subscribe', (req, res) => {
    const userId = Date.now().toString();
    const calendarUrl = `/api/calendar/${userId}`;
    subscribers.set(userId, {
        createdAt: new Date(),
        calendarUrl
    });
    res.json({ userId, calendarUrl });
});

// 生成日历
app.get('/api/calendar/:userId', (req, res) => {
    const { userId } = req.params;
    if (!subscribers.has(userId)) {
        return res.status(404).send('订阅不存在');
    }
    
    const oilPriceData = getOilPriceData();
    const searchResults = getSearchResults();
    const now = new Date();

    // 找到所有未来的调整日期
    let futureAdjustmentDates = [];
    if (oilPriceData.adjustmentDates && Array.isArray(oilPriceData.adjustmentDates)) {
        oilPriceData.adjustmentDates.sort((a, b) => new Date(a.date) - new Date(b.date));
        for (const dateEntry of oilPriceData.adjustmentDates) {
            const adjustmentMoment = moment(dateEntry.date).endOf('day');
            if (adjustmentMoment.isSameOrAfter(moment())) {
                futureAdjustmentDates.push(dateEntry);
            }
        }
    }

    const calendar = generateCalendar(futureAdjustmentDates, { 
        lastUpdate: searchResults.lastUpdate,
        lastTrend: searchResults.lastTrend,
        lastAmount: searchResults.lastAmount,
        lastNews: searchResults.lastNews,
        lastNewsUrl: searchResults.lastNewsUrl
    });

    // log输出最近一次订阅内容（第一个事件）
    try {
        const events = calendar.events();
        if (events && events.length > 0) {
            const first = events[0];
            console.log('最近一次订阅内容：');
            console.log('summary:', first.summary());
            console.log('description:', first.description());
        }
    } catch (e) {
        console.error('打印订阅内容失败:', e);
    }
    
    res.set('Content-Type', 'text/calendar');
    res.set('Content-Disposition', `attachment; filename="oil-price-calendar.ics"`);
    res.send(calendar.toString());
});

// 获取订阅统计
app.get('/api/stats', (req, res) => {
    const oilPriceData = getOilPriceData();
    const searchResults = getSearchResults();
    res.json({
        subscriberCount: subscribers.size,
        dates: oilPriceData.adjustmentDates,
        ...searchResults
    });
});

// 更新油价趋势 (管理界面手动更新)
app.post('/api/update-trend', (req, res) => {
    const { date, trend, amount } = req.body;
    let searchData = getSearchResults();

    // 写入手动调整信息到 search_results.json
    searchData.manualTrend = trend;
    searchData.manualAmount = amount || null;
    searchData.manualUpdate = date;
    searchData.lastUpdate = moment().format('YYYY-MM-DD HH:mm');
    searchData.lastTrend = trend;
    searchData.lastAmount = amount || null;

    saveSearchResults(searchData);
    res.json({ success: true });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Node.js 服务器运行在 http://localhost:${port}`);
    console.log(`Python 后端服务运行在 ${PYTHON_BACKEND_URL}`);
    
    // 设置每日自动触发Python后端爬虫
    schedule.scheduleJob('0 15 * * *', async () => {
        try {
            console.log('触发Python后端油价爬虫...');
            const response = await axios.get(`${PYTHON_BACKEND_URL}/fetch_oil_price`);
            if (response.data.status === 'success') {
                console.log('Python后端油价爬虫执行成功。');
            } else {
                console.error('Python后端油价爬虫执行失败:', response.data.message);
            }
        } catch (error) {
            console.error('调用Python后端油价爬虫失败:', error.message);
        }
    });
}); 