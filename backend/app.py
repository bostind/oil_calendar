import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import os
from flask import Flask, jsonify

app = Flask(__name__)

# tzrq.json 文件路径 (相对于 backend/app.py)
TZRQ_JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'tzrq.json')

# 读取油价调整数据
def get_oil_price_data():
    if not os.path.exists(TZRQ_JSON_PATH):
        # 如果文件不存在，创建一个空的或者默认的结构
        initial_data = {
            "adjustmentDates": [],
            "lastUpdate": "",
            "version": "1.0",
            "description": "油价调整时间表"
        }
        with open(TZRQ_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(initial_data, f, ensure_ascii=False, indent=4)
    with open(TZRQ_JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

# 保存油价调整数据
def save_oil_price_data(data):
    with open(TZRQ_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# 配置请求头，模拟浏览器访问
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
}

# 优先 Bing 搜索摘要
BING_URL = 'https://www.bing.com/search?q=%E6%B2%B9%E4%BB%B7%E8%B0%83%E6%95%B4'
# 兜底：汽油价格网
QIYOU_URL = 'http://www.qiyoujiage.com/'
QIYOU_SELECTOR = '#left > div:nth-child(1)'

# 解析油价信息的通用函数
def parse_oil_info(text):
    # 匹配具体时间（如"06月17日24时"）
    time_match = re.search(r'(\d{1,2})月(\d{1,2})日(\d{1,2})时', text)
    if time_match:
        year = datetime.now().year
        month = int(time_match.group(1))
        day = int(time_match.group(2))
        hour = int(time_match.group(3))
        date_str = f"{year}-{month:02d}-{day:02d} {hour:02d}:00"
    else:
        date_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    # 匹配涨跌
    trend = 'up' if '上调' in text or '上涨' in text else ('down' if '下调' in text or '下降' in text else None)
    # 匹配金额
    amount_match = re.search(r'(\d+(?:\.\d+)?)元/升', text)
    amount = float(amount_match.group(1)) if amount_match else None
    # 匹配油品类型，默认92号汽油
    types = []
    for t in ['92', '95', '98', '0']:
        if t in text:
            types.append(t)
    if not types:
        types.append('92')
    return {
        'date': date_str,
        'trend': trend,
        'amount': amount,
        'types': types
    }

# 抓取 Bing 搜索摘要
def fetch_bing_info():
    print('[Bing] 开始抓取...')
    try:
        resp = requests.get(BING_URL, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        # Bing 摘要一般在 .b_algo 或 .b_caption
        for tag in soup.select('.b_algo, .b_caption'):
            text = tag.get_text(strip=True)
            if '油价' in text and ('上调' in text or '下调' in text or '调整' in text):
                info = parse_oil_info(text)
                print(f'[Bing] 命中摘要: {text}')
                return {
                    'title': text,
                    'source': 'Bing搜索',
                    'url': BING_URL,
                    **info
                }
        print('[Bing] 未找到有效摘要')
    except Exception as e:
        print(f'[Bing] 抓取失败: {e}')
    return None

# 抓取汽油价格网
def fetch_qiyou_info():
    print('[汽油价格网] 开始抓取...')
    try:
        resp = requests.get(QIYOU_URL, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        div = soup.select_one(QIYOU_SELECTOR)
        if div:
            text = div.get_text(strip=True)
            if '油价' in text and ('上调' in text or '下调' in text or '调整' in text):
                info = parse_oil_info(text)
                print(f'[汽油价格网] 命中内容: {text}')
                return {
                    'title': text,
                    'source': '汽油价格网',
                    'url': QIYOU_URL,
                    **info
                }
        print('[汽油价格网] 未找到有效内容')
    except Exception as e:
        print(f'[汽油价格网] 抓取失败: {e}')
    return None

# 主函数：获取油价信息
@app.route('/fetch_oil_price', methods=['GET'])
def fetch_oil_price_api():
    try:
        # 优先 Bing
        result = fetch_bing_info()
        if not result:
            # 兜底汽油价格网
            result = fetch_qiyou_info()
        if not result:
            print('未能获取到有效的油价调整信息')
            return jsonify({'status': 'error', 'message': '未能获取到有效的油价调整信息'}), 500
        # 写入 tzrq.json
        data = get_oil_price_data()
        data['lastUpdate'] = result['date']
        data['lastTrend'] = result['trend']
        data['lastAmount'] = result['amount']
        data['lastTypes'] = result['types']
        data['lastSource'] = result['source']
        data['lastNews'] = result['title']
        data['lastNewsUrl'] = result['url']
        if 'newsHistory' not in data:
            data['newsHistory'] = []
        data['newsHistory'].insert(0, {
            'date': result['date'],
            'title': result['title'],
            'source': result['source'],
            'url': result['url'],
            'trend': result['trend'],
            'amount': result['amount'],
            'types': result['types'],
            'score': 10
        })
        data['newsHistory'] = data['newsHistory'][:30]
        save_oil_price_data(data)
        return jsonify({'status': 'success', **result})
    except Exception as e:
        print(f'获取油价信息失败: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Flask 应用启动
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 