<template>
	<div class="upload-modal">
		<div class="upload-modal-content">
			<h2>{{ type === "image" ? "上传图片" : "上传文件" }}</h2>
			<input
				type="file"
				@change="handleFileChange"
				:accept="acceptTypes" />
			<div class="button-group">
				<button
					@click="uploadFile"
					:disabled="!selectedFile">
					上传
				</button>
				<button @click="$emit('close')">取消</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref, computed } from "vue";
	import apiClient from "../apis/apiClient";

	const props = defineProps<{
		type: "image" | "file";
	}>();

	const emit = defineEmits<{
		(e: "close", fileUrl?: string): void;
	}>();

	const selectedFile = ref<File | null>(null);

	const acceptTypes = computed(() => {
		return props.type === "image" ? "image/*" : "*/*";
	});

	const handleFileChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			selectedFile.value = target.files[0];
		}
	};

	const uploadFile = async () => {
		if (!selectedFile.value) return;

		try {
			const formData = new FormData();
			formData.append("file", selectedFile.value);

			const response = await apiClient.post("/upload", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			});

			const fileUrl = response.data.url;
			emit("close", fileUrl);
		} catch (error) {
			console.error("Upload failed:", error);
			alert("File upload failed. Please try again.");
		}
	};
</script>

<style scoped>
	.upload-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.upload-modal-content {
		background-color: white;
		padding: 20px;
		border-radius: 5px;
		width: 300px;
	}

	h2 {
		margin-top: 0;
	}

	input[type="file"] {
		margin-bottom: 10px;
	}

	.button-group {
		display: flex;
		justify-content: space-between;
	}

	button {
		padding: 5px 10px;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 3px;
		cursor: pointer;
	}

	button:disabled {
		background-color: #a0a0a0;
		cursor: not-allowed;
	}
</style>
