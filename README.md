## 说明

> 本脚本仅适用于自用，敬请外部人员不要使用，谢谢。
>
> 本脚本是用于堡垒机的自动登录、跳板机的自动登录、网厅信息注入及其他功能。需要事先配置方可使用。

## 1. 安装

> 取自知乎《[Tampermonkey油猴插件——安装与使用教程](https://zhuanlan.zhihu.com/p/128453110)》一文，不明白可以点击链接直接跳转。

### 1.1 介绍

相信熟悉浏览器的都知道，尤其是大名鼎鼎的Chrome浏览器，丰富的扩展程序让很多人体验到了浏览器的神奇之处，而一个没有安装扩展程序的浏览器也是不完整的。

而在众多的扩展中，就不得不提到一个浏览器插件——**Tampermonkey**。中文俗称油猴。

相信很多人也听说过，大家可以把他理解为一个用户脚本管理器。它本身是无法为我们发挥什么作用的，它主要依靠各大社区编写的扩展脚本（JavaScript代码）运行在浏览器上，来改变被访问网页的功能，提升我们的网页浏览体验
。

### 1.2 **插件安装**

方法一：

> ①直接百度手动搜索进入**[Tampermonkey官网](https://www.tampermonkey.net/)**。
>
> ![img](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/v2-da820e2e2e3eede3d41f1572ff81533b_r.jpg)
>
> Tampermonkey Stable为正式版，Tampermonkey Beta为测试版
>
> 点击**下载**，页面跳转至Edge外接扩展商店的安装页面，我们直接**获取**安装就好了，如下图。
>
> ![img](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/v2-997cba084102d92b7dbc8f3139c0eb48_r.jpg)
>
> Edge以外的其他浏览器点击下载则会跳转至**[chrome 网上应用店](https://chrome.google.com/webstore/category/extensions)**，正常情况下咱们是打不开的，需要科学上网才可以打开。
>
> ②或者，很多浏览器里也贴心的自带有相应的扩展市场，我们也可以直接在其扩展应用市场之类的地方直接安装。
>
> ![img](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/v2-e9bdff9569fda02991355c278e6bba70_r.jpg)
>
> 360浏览器应用市场

方法二：

> 考虑到文明上网的普及问题，非Edge以外的其他浏览器，我们也可以在很多渠道获取[Tampermonkey的crx文件（点击下载）](https://wmhl.lanzoui.com/ib8glab)
> ，将下载下来的压缩包解压出来，其中类型为**CRX文件**就是接下来需要用到的安装文件。
>
> 打开浏览器**设置，**打开**扩展程序**页面，或者直接搜索**Chrome://extensions/**进入。然后保持页面**开发者模式**
> 的开启。找到被解压后的tampermonkey.crx文件，将其拖动到**扩展程序**页面，释放并同意完成安装。
>
> ![img](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/v2-947ceb4ff0dd70cc7f240cf8ba822b5d_r.jpg)
>
> 成功安装后会弹出这个窗口，页面右上角也会出现油猴扩展的logo。
>
> ![img](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/v2-95ed908003b4c0702242b593a20da1b7_r.jpg)
>
> 不同浏览器所支持的扩展及安装过程可能略有出入，这里呢就主要以我的情况来介绍，不过**理论上支持chrome内核的其他浏览器都是可以安装的。**

### 1.3 安装本脚本

打开本页面[跳板机登录](https://greasyfork.org/zh-CN/scripts/454620-%E8%B7%B3%E6%9D%BF%E6%9C%BA%E7%99%BB%E5%BD%95)
,点击绿色的安装按钮，版本可能不一致，但是位置都是这里。我的是已经安装完成了，所以显示重新安装。

![image-20221114154953574](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221114154953574.png)

安装完后，大工告成

## 2. 菜单

![image-20221110165044285](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221110165044285.png)

### 2.1 堡垒机自动登录

该设置项为true的时候，堡垒机自动登录能用，false的时候不生效

点击切换设置项

### 2.2 跳板机自动登录

该设置项为true的时候，跳板机自动登录能用，false的时候不生效

点击切换设置项

### 2.3 F11自动最大化

1. 该设置项为true的时候，跳板机按F11,自动将跳板机右侧栏收起并自适应桌面尺寸。
2. 该设置项为true的时候，跳板机点击右下角全屏按钮,自动将跳板机右侧栏收起并自适应桌面尺寸。

> 注意：f11的时候需要焦点获取到浏览器页面，焦点不能在跳板机windows里面。简单来说就是鼠标点一下右栏或者下栏的白色区域。见下图，需要点击图中红框
>
> ![image-20221111111249648](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111111249648.png)

### 2.4 网厅自动注入信息

当该设置项为true的时候，在网厅会自动读取单位参保信息等进行注入，并在点击第五项设置项时弹窗显示。

### 2.5 设置

点击该按钮会打开设置弹窗，并进行一些自定义设置。具体设置项在后续说明。

### 2.6 显示当前单位信息

点击该按钮会打开当前单位信息弹窗，里面包含当前登录单位的一些信息。没登录或者不是设置的地方，不会显示。具体情况见下图。

![image-20221111144902981](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111144902981.png)

## 3. 设置

点击设置后会有如下几个设置项。需要注意的是：四个列表配置的时候必须得是JsonArray格式。

![image-20221111145851728](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111145851728.png)

### 3.1 自动登录配置

同上面菜单介绍里介绍一致，分别为跳板机自动登录、堡垒机自动登录、F11自动最大化、网厅注入信息。这四个为使能按钮。

### 3.2 堡垒机列表

该项配置需要自动登录的列表。

```json
[{
	"addr": "https://127.0.0.1/#/login",
	"username": "username",
	"password": "password"
},{
	"addr": "https://127.0.0.1/#/login",
	"username": "username",
	"password": "password"
}]
```

如上，必须为JSONArray，需要使用https://www.bejson.com/校验格式化通过方可，不然不会生效

其中对象属性分别为：

> - addr
    >
    >   配置堡垒机登录的地址，全地址也行，截取一些重要信息的部分地址也行。但是得具有唯一性
>
> - username
    >
    >   堡垒机登录时的用户名
>
> - password
    >
    >   堡垒机登录时的密码

### 3.3 跳板机列表

该项配置需要自动登录的列表。

```json
[{
	"addr": "https://127.0.0.1/#/desktop",
	"ip": "127.0.0.1:8080",
	"username": "username",
	"password": "password"
},{
	"addr": "https://127.0.0.1/#/desktop",
	"ip": "127.0.0.1:8080",
	"username": "username",
	"password": "password"
}]
```

如上，必须为JSONArray，需要使用https://www.bejson.com/校验格式化通过方可，不然不会生效

其中对象属性分别为：

> - addr
    >
    >   配置跳板机登录的地址，全地址也行，截取一些重要信息的部分地址也行。但是得具有唯一性
>
> - ip
    >
    >   需要登录的跳板机ip及端口，配置完如果不生效需要手动先登录一次方可。
>
> - username
    >
    >   跳板机登录时的用户名
>
> - password
    >
    >   跳板机登录时的密码

### 3.4 F11最大化列表

该项配置需要自动最大化的列表。

```json
[{
	"addr": "127.0.0.1/connect"
},{
	"addr": "127.0.0.1/connect"
}]
```

如上，必须为JSONArray，需要使用https://www.bejson.com/校验格式化通过方可，不然不会生效

其中对象属性分别为：

> - addr
    >
    >   配置需要F11最大话的地址，及需要最大化的那个网页地址栏里面的地址。只需要截取前面的即可，不用全部复制

### 3.5 网厅注入信息列表

该项配置需要注入信息的地方的列表

```json
[{
	"keywords": "/hallUnit"
},{
	"keywords": "/hallEnter"
}]
```

如上，必须为JSONArray，需要使用https://www.bejson.com/校验格式化通过方可，不然不会生效

其中对象属性分别为：

> - keywords
    >
    >   这个配置项填地址栏中最具代表性的，多个页面都有的关键字。比如单位 `/hallUnit` 、门户 `/hallEnter` 等。目前只支持门户跟单位，个人不支持。

## 4. 高级使用

由于启用页面有一定的限制，有的启用页面并没有添加，需要自行添加。

### 4.1 油猴设置

![image-20221111152328197](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152328197.png)**![image-20221111152420619](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152420619.png)![image-20221111152504132](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152504132.png)![image-20221111152542737](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152542737.png)**

> 1. 点击油猴图标
> 2. 找到跳板机登录项，点进去
> 3. 点击设置，往下翻
> 4. 用户包括里面点击添加。添加的规则可以使用通配符*

### 4.2 其他可玩性

代码是完全开源的，随时可以查看、修改、调试。但是记得一定要保留作者信息
