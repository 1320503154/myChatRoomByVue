<template>
	<div class="chat-container">
		<!-- 聊天室列表 -->
		<div class="chat-room-list">
			<div
				v-for="room in roomList"
				:key="room.id"
				:class="['chat-room-item', { selected: room.id === currentRoomId }]"
				@click="selectRoom(room.id)">
				{{ room.name }}
			</div>
		</div>

		<!-- 消息列表 -->
		<div
			class="message-list"
			ref="messageListRef">
			<div
				v-for="message in chatHistory"
				:key="message.id"
				:class="[
					'message-item',
					{ 'from-me': message.senderId === userInfo.id },
				]">
				<div class="message-sender">
					<img
						:src="message.sender.headPic"
						:alt="message.sender.nickName" />
					<span class="sender-nickname">{{ message.sender.nickName }}</span>
				</div>
				<div class="message-content">
					<template v-if="message.type === 'text'">
						{{ message.content }}
					</template>
					<img
						v-else-if="message.type === 'image'"
						:src="message.content"
						alt="Shared image"
						@click="openImagePreview(message.content)" />
					<div v-else-if="message.type === 'file'">
						<a
							:href="message.content"
							download>
							<i class="file-icon"></i>
							{{ getFileName(message.content) }}
						</a>
					</div>
				</div>
			</div>
		</div>

		<!-- 消息输入 -->
		<div class="message-input">
			<div class="message-type">
				<button
					@click="openEmojiPicker"
					class="message-type-item">
					<i class="emoji-icon"></i>
				</button>
				<button
					@click="openUploadModal('image')"
					class="message-type-item">
					<i class="image-icon"></i>
				</button>
				<button
					@click="openUploadModal('file')"
					class="message-type-item">
					<i class="file-icon"></i>
				</button>
			</div>
			<div class="message-input-area">
				<textarea
					v-model="inputText"
					@keydown.enter.prevent="sendMessage"
					@paste="handlePaste"
					placeholder="Type a message..."></textarea>
				<button
					@click="sendMessage"
					class="send-button">
					Send
				</button>
			</div>
		</div>

		<!-- 表情选择器 -->
		<EmojiPicker
			v-if="showEmojiPicker"
			:native="true"
			@select="addEmoji"
			@outside-click="showEmojiPicker = false" />

		<!-- 上传模态框组件 -->
		<upload-modal
			v-if="showUploadModal"
			:type="uploadType"
			@close="handleUploadModalClose" />

		<!-- 图片预览模态框 -->
		<image-preview-modal
			v-if="showImagePreview"
			:image-url="previewImageUrl"
			@close="closeImagePreview" />
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, watch, nextTick, computed } from "vue";
	import { io, Socket } from "socket.io-client";
	import axios from "axios";
	import EmojiPicker from "vue3-emoji-picker";
	import "vue3-emoji-picker/css";
	import UploadModal from "./UploadModal.vue";
	import ImagePreviewModal from "./ImagePreviewModal.vue";
	import { useUserStore } from "@/stores/user";
	import { useChatStore } from "@/stores/chat";

	// Stores
	const userStore = useUserStore();
	const chatStore = useChatStore();

	// Refs
	const socket = ref<Socket | null>(null);
	const messageListRef = ref<HTMLElement | null>(null);
	const inputText = ref("");
	const showEmojiPicker = ref(false);
	const showUploadModal = ref(false);
	const showImagePreview = ref(false);
	const previewImageUrl = ref("");
	const uploadType = ref<"image" | "file">("image");

	// Computed
	const userInfo = computed(() => userStore.userInfo);
	const currentRoomId = computed(() => chatStore.currentRoomId);
	const roomList = computed(() => chatStore.roomList);
	const chatHistory = computed(() => chatStore.chatHistory);

	// Methods
	const initSocket = () => {
		socket.value = io(import.meta.env.VITE_SOCKET_URL);
		socket.value.on("connect", () => {
			console.log("Socket connected");
		});
		socket.value.on("message", handleSocketMessage);
	};

	const handleSocketMessage = (reply: any) => {
		if (reply.type === "sendMessage") {
			chatStore.addMessage(reply.message);
			scrollToBottom();
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
		chatStore.setCurrentRoomId(roomId);
	};

	const sendMessage = () => {
		if (!inputText.value.trim() || !currentRoomId.value) return;

		const payload = {
			sendUserId: userInfo.value.id,
			chatroomId: currentRoomId.value,
			message: {
				type: "text" as const,
				content: inputText.value,
			},
		};

		socket.value?.emit("sendMessage", payload);
		inputText.value = "";
	};

	const openEmojiPicker = () => {
		showEmojiPicker.value = true;
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
			sendUserId: userInfo.value.id,
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

			const response = await axios.post("/api/upload", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});

			const fileUrl = response.data.fileUrl;
			sendFileMessage(fileUrl, type);
		} catch (error) {
			console.error("Upload failed:", error);
			// Show error message to user
		}
	};

	const openImagePreview = (imageUrl: string) => {
		previewImageUrl.value = imageUrl;
		showImagePreview.value = true;
	};

	const closeImagePreview = () => {
		showImagePreview.value = false;
	};

	const getFileName = (url: string) => {
		return url.split("/").pop() || "File";
	};

	// Lifecycle hooks
	onMounted(() => {
		initSocket();
		userStore.fetchUserInfo();
		chatStore.fetchChatroomList();
	});

	// Watchers
	watch(currentRoomId, (newRoomId) => {
		if (newRoomId) {
			socket.value?.emit("joinRoom", {
				chatroomId: newRoomId,
				userId: userInfo.value.id,
			});
			chatStore.fetchChatHistory(newRoomId);
		}
	});
</script>

<style scoped>
	.chat-container {
		display: flex;
		height: 100vh;
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
		background-color: #f0f0f0;
		padding: 10px;
		border-radius: 10px;
		max-width: 70%;
	}

	.message-item.from-me .message-content {
		background-color: #dcf8c6;
		margin-left: auto;
	}

	.message-input {
		padding: 20px;
		background-color: #f9f9f9;
	}

	.message-type {
		display: flex;
		margin-bottom: 10px;
	}

	.message-type-item {
		margin-right: 10px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 20px;
	}

	.message-input-area {
		display: flex;
	}

	.message-input-area textarea {
		flex: 1;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 5px;
		resize: none;
	}

	.send-button {
		margin-left: 10px;
		padding: 10px 20px;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
	}

	.send-button:hover {
		background-color: #45a049;
	}

	/* Add icon styles */
	.emoji-icon,
	.image-icon,
	.file-icon {
		width: 24px;
		height: 24px;
		background-size: contain;
		background-repeat: no-repeat;
	}

	.emoji-icon {
		background-image: url("path_to_emoji_icon.svg");
	}

	.image-icon {
		background-image: url("path_to_image_icon.svg");
	}

	.file-icon {
		background-image: url("path_to_file_icon.svg");
	}
</style>
