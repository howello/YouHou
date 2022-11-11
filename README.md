## 说明

> 本脚本仅适用于自用，敬请外部人员不要使用，谢谢。
>
> 本脚本是用于堡垒机的自动登录、跳板机的自动登录、网厅信息注入及其他功能。需要事先配置方可使用。



## 1. 菜单

![image-20221110165044285](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221110165044285.png)

### 1.1 堡垒机自动登录

该设置项为true的时候，堡垒机自动登录能用，false的时候不生效

点击切换设置项

### 1.2 跳板机自动登录

该设置项为true的时候，跳板机自动登录能用，false的时候不生效

点击切换设置项

### 1.3 F11自动最大化

1. 该设置项为true的时候，跳板机按F11,自动将跳板机右侧栏收起并自适应桌面尺寸。
2. 该设置项为true的时候，跳板机点击右下角全屏按钮,自动将跳板机右侧栏收起并自适应桌面尺寸。

> 注意：f11的时候需要焦点获取到浏览器页面，焦点不能在跳板机windows里面。简单来说就是鼠标点一下右栏或者下栏的白色区域。见下图，需要点击图中红框
>
> ![image-20221111111249648](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111111249648.png)

### 1.4 网厅自动注入信息

当该设置项为true的时候，在网厅会自动读取单位参保信息等进行注入，并在点击第五项设置项时弹窗显示。

### 1.5 设置

点击该按钮会打开设置弹窗，并进行一些自定义设置。具体设置项在后续说明。

### 1.6 显示当前单位信息

点击该按钮会打开当前单位信息弹窗，里面包含当前登录单位的一些信息。没登录或者不是设置的地方，不会显示。具体情况见下图。

![image-20221111144902981](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111144902981.png)

## 2. 设置

点击设置后会有如下几个设置项。需要注意的是：四个列表配置的时候必须得是JsonArray格式。

![image-20221111145851728](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111145851728.png)

### 2.1 自动登录配置

同上面菜单介绍里介绍一致，分别为跳板机自动登录、堡垒机自动登录、F11自动最大化、网厅注入信息。这四个为使能按钮。

### 2.2 堡垒机列表

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

### 2.3 跳板机列表

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

### 2.4 F11最大化列表

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

### 2.5 网厅注入信息列表

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

## 3. 高级使用

由于启用页面有一定的限制，有的启用页面并没有添加，需要自行添加。

### 3.1 油猴设置

![image-20221111152328197](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152328197.png)**![image-20221111152420619](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152420619.png)![image-20221111152504132](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152504132.png)![image-20221111152542737](https://howe-pic-bed.oss-cn-beijing.aliyuncs.com/picbed/image-20221111152542737.png)**

> 1. 点击油猴图标
> 2. 找到跳板机登录项，点进去
> 3. 点击设置，往下翻
> 4. 用户包括里面点击添加。添加的规则可以使用通配符*

3.2 其他可玩性

代码是完全开源的，随时可以查看、修改、调试。但是记得一定要保留作者信息