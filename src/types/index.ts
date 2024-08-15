// 定义 User 接口，描述发送者的信息
export interface User {
    id: number;
    username: string;
    nickName: string;
    email: string;
    createTime: string; // 也可以考虑使用 Date 类型
    headPic: string;
}

// 定义 Message 接口，描述消息的信息
export interface Message {
    id: number;
    content: string;
    type: number; // 可以考虑将类型用枚举来表示
    chatroomId: number;
    senderId: number;
    createTime: string; // 也可以考虑使用 Date 类型
    updateTime: string; // 也可以考虑使用 Date 类型
    sender: User; // 引用 User 接口
}

// 可以定义一个接口表示消息列表
export interface MessageList {
    messages: Message[];
}// 定义群聊类型接口
export interface GroupChat {
    id: number;                  // 群聊的唯一标识符
    name: string;                // 群聊名称
    type: boolean;               // 群聊类型，可能表示是否为公开/私密群聊
    createTime: string;          // 群聊创建时间
    userCount: number;           // 当前在线用户的数量
    userIds: number[];           // 群聊成员的用户ID数组
}