import os
import sys

# 如果你有其他包含节点的 python 文件，比如 f_nodes_main.py，可以这样导入：
# from .f_nodes_main import MyCustomNode

# 这里是节点映射字典。键是 ComfyUI 内部使用的节点ID（英文，需唯一），值是对应的 Python 类。
NODE_CLASS_MAPPINGS = {
    # "MyCustomNode_F": MyCustomNode,
}

# 这里是节点在 ComfyUI 界面中显示的名称字典。
NODE_DISPLAY_NAME_MAPPINGS = {
    # "MyCustomNode_F": "显示名称 (F-Nodes)",
}

# 导出映射，ComfyUI 会自动读取这里的定义
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

print("\033[34m[F_nodes]\033[0m Loaded successfully.")
