import importlib


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


ANY_TYPE = AnyType("*")


class ByPassTypeTuple(tuple):
    def __getitem__(self, index):
        if index > 0:
            index = 0
        return super().__getitem__(index)


class F_DynamicSwitch:
    """
    1 个任意输入，输出口保持为「已连接数量 n + 1」。
    通过 active_index 选择哪个输出口输出输入值，其他输出为 ExecutionBlocker。
    """

    MAX_OUTPUTS = 64

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "any_input": (ANY_TYPE,),
                "active_index": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": cls.MAX_OUTPUTS - 1,
                        "step": 1,
                        "display": "number",
                    },
                ),
            }
        }

    RETURN_TYPES = ByPassTypeTuple((ANY_TYPE,))
    RETURN_NAMES = ByPassTypeTuple(("out_0",))
    FUNCTION = "route"
    CATEGORY = "F_nodes"

    def route(self, any_input, active_index):
        try:
            ExecutionBlocker = importlib.import_module("comfy_execution.graph").ExecutionBlocker
        except Exception:
            ExecutionBlocker = importlib.import_module("comfy_execution.graph_utils").ExecutionBlocker

        outputs = [ExecutionBlocker(None)] * self.MAX_OUTPUTS
        selected = min(max(int(active_index), 0), self.MAX_OUTPUTS - 1)
        outputs[selected] = any_input
        return tuple(outputs)


NODE_CLASS_MAPPINGS = {
    "F_DynamicSwitch": F_DynamicSwitch,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "F_DynamicSwitch": "F Dynamic Switch",
}

WEB_DIRECTORY = "./js"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]

print("\033[34m[F_nodes]\033[0m Loaded successfully.")
