



## zsh

### 安装zsh
```bash
sudo apt install zsh
```

### 安装Oh My Zsh
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### 安装插件
1. 自动建议插件
```bash 
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
```

2. 语法高亮插件（输对了变绿，输错了变红）
```bash
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

3. 启用插件
```bash
vim ~/.zshrc
```
将 `plugins=(git)`这一行修改为如下：
```bash
plugins=(git zsh-autosuggestions zsh-syntax-highlighting)
```

4. 修改主题
[主题连接](https://github.com/ohmyzsh/ohmyzsh/wiki/Themes)
```bash
# 每次登录随机主题
ZSH_THEME="random"
```

5. 插件生效
```bash
source .zshrc
```



