const { fetchOilPrice } = require('./utils/crawler');

async function run() {
    console.log('开始执行油价爬虫...');
    try {
        const result = await fetchOilPrice();
        console.log('油价爬虫执行成功，获取到最新信息:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('油价爬虫执行失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
            console.error('响应状态码:', error.response.status);
            console.error('响应头:', error.response.headers);
        } else if (error.request) {
            console.error('请求未收到响应:', error.request);
        } else {
            console.error('错误信息:', error.message);
        }
    }
    console.log('油价爬虫执行结束。');
}

run(); 