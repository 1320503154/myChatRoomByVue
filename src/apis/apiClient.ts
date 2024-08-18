import axios from "axios";

const tokenKey = "auth_token"; // 本地存储中的token键名

// 创建axios实例
const apiClient = axios.create({
	baseURL: "http://localhost:3005", // 替换为你的后端URL
	timeout: 5000, // 请求超时时间
});

// 请求拦截器
apiClient.interceptors.request.use(
	async (config) => {
		// 获取token
		let token = localStorage.getItem(tokenKey);
		// 如果没有token，提示用户输入
		if (!token) {
			token = await promptUserForToken();
		}

		// 将token添加到请求头中
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		return config;
	},
	(error) => {
		// 请求错误处理
		return Promise.reject(error);
	}
);

// 响应拦截器（可选）
apiClient.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		if (error.response?.status === 401) {
			// 处理未授权或token失效的情况
			alert("授权失败，请重新登录");
			localStorage.removeItem(tokenKey); // 清除失效的token
		}
		return Promise.reject(error);
	}
);

// 提示用户输入token并存储到本地
async function promptUserForToken(): Promise<string | null> {
	const token = prompt("请输入你的授权Token:");
	if (token) {
		localStorage.setItem(tokenKey, token); // 存储token
	}
	return token;
}

export default apiClient;
