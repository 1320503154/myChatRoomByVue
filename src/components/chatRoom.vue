<template>
	<div class="chat-container">
		<!-- Chat room list -->
		<div class="chat-room-list">
			<div
				v-for="room in roomList"
				:key="room.id"
				:class="['chat-room-item', { selected: room.id === currentRoomId }]"
				@click="selectRoom(room.id)">
				{{ room.name }}
			</div>
		</div>

		<!-- Message list -->
		<div
			class="message-list"
			ref="messageListRef">
			<div
				v-for="message in chatHistory"
				:key="message.id"
				:class="[
					'message-item',
					{ 'from-me': message.sender.id === userInfo?.id },
				]">
				<div class="message-sender">
					<img
						:src="message.sender.headPic"
						:alt="message.sender.nickName" />
					<span class="sender-nickname">{{ message.sender.nickName }}</span>
				</div>
				<div class="message-content">
					<template v-if="message.type == 0">
						{{ message.content }}
					</template>
					<img
						v-else-if="message.type == 1"
						:src="message.content"
						style="max-width: 200px" />
					<div v-else-if="message.type == 2">
						<a
							:href="message.content"
							download
							>{{ message.content }}</a
						>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Message input -->
	<div class="message-input">
		<div class="message-type">
			<div
				class="message-type-item"
				@click="toggleEmojiPicker">
				表情
			</div>
			<div
				class="message-type-item"
				@click="openUploadModal('image')">
				图片
			</div>
			<div
				class="message-type-item"
				@click="openUploadModal('file')">
				文件
			</div>
		</div>
		<div class="message-input-area">
			<textarea
				v-model="inputText"
				@keydown="handleKeydown"
				@paste="handlePaste"></textarea>
			<button @click="sendMessage">发送</button>
		</div>
	</div>

	<!-- Emoji picker -->
	<div
		v-if="showEmojiPicker"
		class="emoji-picker">
		<EmojiPicker
			:native="true"
			@select="addEmoji" />
	</div>

	<!-- Upload modal component -->
	<upload-modal
		v-if="showUploadModal"
		:type="uploadType"
		@close="handleUploadModalClose" />
</template>

<script setup lang="ts">
	import { ref, onMounted, watch, nextTick } from "vue";
	import { io, Socket } from "socket.io-client";
	import EmojiPicker from "vue3-emoji-picker";
	import "vue3-emoji-picker/css";
	import UploadModal from "./UploadModal.vue";
	import apiClient from "../apis/apiClient";
	import { User, Message, GroupChat } from "../types/index.ts";

	// State
	const socket = ref<Socket | null>(null);
	const currentRoomId = ref<number | null>(null);
	const userInfo = ref<User | null>(null); // 用户信息默认为 null
	const roomList = ref<GroupChat[]>([]); // 修正了 roomList 的类型
	const chatHistory = ref<Message[]>([]); // chatHistory 是 Message 数组
	const inputText = ref<string>("");
	const showEmojiPicker = ref<boolean>(false);
	const showUploadModal = ref<boolean>(false);
	const uploadType = ref<"image" | "file">("image");
	const messageListRef = ref<HTMLElement | null>(null);
	// Methods
	const initSocket = () => {
		socket.value = io("http://localhost:3005");
		socket.value.on("connect", () => {
			console.log("Socket connected");
		});
		socket.value.on("message", handleSocketMessage);
	};

	const handleSocketMessage = (reply: any) => {
		if (reply.type === "sendMessage") {
			chatHistory.value.push(reply.message);
			scrollToBottom();
		}
	};
	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	};
	const scrollToBottom = () => {
		nextTick(() => {
			if (messageListRef.value) {
				messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
			}
		});
	};

	const selectRoom = (roomId: number) => {
		currentRoomId.value = roomId;
		joinRoom(roomId);
		fetchChatHistory(roomId);
	};

	const joinRoom = (roomId: number) => {
		if (socket.value) {
			socket.value.emit("joinRoom", {
				chatroomId: roomId,
				userId: userInfo.value?.id,
			});
		}
	};

	const sendMessage = () => {
		if (!inputText.value.trim() || !currentRoomId.value) return;
		console.log("In chatRoom.vue currentRoomId::: ", currentRoomId.value);

		const payload = {
			sendUserId: userInfo.value?.id,
			chatroomId: currentRoomId.value,
			message: {
				type: "text" as const,
				content: inputText.value,
			},
		};

		socket.value?.emit("sendMessage", payload);
		inputText.value = "";
	};

	const fetchUserInfo = async () => {
		try {
			const response = await apiClient.get("/user/info");
			userInfo.value = response.data;
		} catch (error) {
			console.error("Failed to fetch user info:", error);
		}
	};

	const fetchChatroomList = async () => {
		try {
			const response = await apiClient.get("/chatroom/list");
			roomList.value = response.data;
		} catch (error) {
			console.error("Failed to fetch chatroom list:", error);
		}
	};

	const fetchChatHistory = async (roomId: number) => {
		try {
			const response = await apiClient.get(
				`/chat-history/list?chatroomId=${roomId}`
			);
			chatHistory.value = response.data;
			console.log("Fetched chat history:", chatHistory.value);

			scrollToBottom();
		} catch (error) {
			console.error("Failed to fetch chat history:", error);
		}
	};

	const toggleEmojiPicker = () => {
		showEmojiPicker.value = !showEmojiPicker.value;
	};

	const addEmoji = (emoji: any) => {
		inputText.value += emoji.native;
		showEmojiPicker.value = false;
	};

	const openUploadModal = (type: "image" | "file") => {
		uploadType.value = type;
		showUploadModal.value = true;
	};

	const handleUploadModalClose = (fileUrl?: string) => {
		showUploadModal.value = false;
		if (fileUrl) {
			sendFileMessage(fileUrl, uploadType.value);
		}
	};

	const sendFileMessage = (fileUrl: string, type: "image" | "file") => {
		if (!currentRoomId.value) return;

		const payload = {
			sendUserId: userInfo.value?.id,
			chatroomId: currentRoomId.value,
			message: {
				type,
				content: fileUrl,
			},
		};

		socket.value?.emit("sendMessage", payload);
	};

	const handlePaste = async (event: ClipboardEvent) => {
		const items = event.clipboardData?.items;
		if (!items) return;

		for (let i = 0; i < items.length; i++) {
			if (items[i].type.indexOf("image") !== -1) {
				const blob = items[i].getAsFile();
				if (blob) {
					event.preventDefault();
					await uploadAndSendFile(blob, "image");
				}
			}
		}
	};

	const uploadAndSendFile = async (file: File, type: "image" | "file") => {
		try {
			const formData = new FormData();
			formData.append("file", file);

			const response = await apiClient.post("/upload", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			});

			const fileUrl = response.data.url;
			sendFileMessage(fileUrl, type);
		} catch (error) {
			console.error("Upload failed:", error);
			alert("File upload failed. Please try again.");
		}
	};

	// Lifecycle hooks
	onMounted(() => {
		initSocket();
		fetchUserInfo();
		fetchChatroomList();
		fetchChatHistory(1);
	});

	// Watchers
	watch(currentRoomId, (newRoomId) => {
		if (newRoomId) {
			joinRoom(newRoomId);
			fetchChatHistory(newRoomId);
		}
	});
</script>

<style scoped>
	.chat-container {
		display: flex;
		height: 100vh;
		flex-direction: column;
		font-family: Arial, sans-serif;
	}

	.chat-room-list {
		width: 200px;
		background-color: #f0f0f0;
		overflow-y: auto;
	}

	.chat-room-item {
		padding: 10px;
		cursor: pointer;
	}

	.chat-room-item.selected {
		background-color: #e0e0e0;
	}

	.message-list {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		background-color: #ffffff;
	}

	.message-item {
		margin-bottom: 15px;
	}

	.message-sender {
		display: flex;
		align-items: center;
		margin-bottom: 5px;
	}

	.message-sender img {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		margin-right: 10px;
	}

	.message-content {
		background-color: #e6e6e6;
		padding: 10px;
		border-radius: 10px;
		max-width: 70%;
	}

	.from-me .message-content {
		background-color: #dcf8c6;
		margin-left: auto;
	}

	.message-input {
		padding: 20px;
		background-color: #f0f0f0;
	}

	.message-type {
		display: flex;
		margin-bottom: 10px;
	}

	.message-type-item {
		margin-right: 10px;
		cursor: pointer;
		color: #4a4a4a;
	}

	.message-input-area {
		display: flex;
	}

	.message-input-area textarea {
		flex: 1;
		height: 60px;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 5px;
		resize: none;
	}

	.message-input-area button {
		margin-left: 10px;
		padding: 0 20px;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
	}

	.emoji-picker {
		position: absolute;
		bottom: 100px;
		right: 20px;
	}
</style>
