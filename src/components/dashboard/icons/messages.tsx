const MessagesIcon = () => {
    return (
        <svg
            width={50}
            height={50}
            viewBox="0 0 512 512"
            xmlns="http://www.w3.org/2000/svg"
            className="size-8"
        >
            <defs>
                <linearGradient
                    id="messagesGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                >
                    <stop offset="0%" stopColor="#4275E4" />
                    <stop offset="100%" stopColor="#A1BCF4" />
                </linearGradient>
            </defs>
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    fill="url(#messagesGradient)"
                    d="M4 2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7.333L3 21.5A1 1 0 0 1 2 21V4a2 2 0 0 1 2-2zm3 6v2h10V8H7zm0 4v2h7v-2H7z"
                />
            </svg>
        </svg>
    );
};

export default MessagesIcon;
