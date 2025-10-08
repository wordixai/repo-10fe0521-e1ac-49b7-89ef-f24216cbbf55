import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Upload, Download, RotateCcw, Eraser, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<"erase" | "fill">("erase");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (image && canvasRef.current && maskCanvasRef.current) {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const maskCtx = maskCanvas.getContext("2d");

      if (ctx && maskCtx) {
        canvas.width = image.width;
        canvas.height = image.height;
        maskCanvas.width = image.width;
        maskCanvas.height = image.height;

        ctx.drawImage(image, 0, 0);
        maskCtx.fillStyle = "black";
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
    }
  }, [image]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          toast({
            title: "图片已上传",
            description: "现在可以开始编辑图片",
          });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== "mousedown") return;
    if (!maskCanvasRef.current || !canvasRef.current) return;

    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    const maskCtx = maskCanvas.getContext("2d");
    const ctx = canvas.getContext("2d");

    if (!maskCtx || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    maskCtx.globalCompositeOperation = "source-over";
    maskCtx.fillStyle = "white";
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize, 0, Math.PI * 2);
    maskCtx.fill();

    if (image) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (maskData.data[i] > 128) {
          imageData.data[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
  };

  const inpaintImage = () => {
    if (!canvasRef.current || !maskCanvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");

    if (!ctx || !maskCtx) return;

    toast({
      title: "正在填充...",
      description: "请稍候，正在处理图片",
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const mask = maskData.data;

    const isMasked = (x: number, y: number): boolean => {
      const idx = (y * canvas.width + x) * 4;
      return mask[idx] > 128;
    };

    const getPixel = (x: number, y: number): [number, number, number, number] => {
      const idx = (y * canvas.width + x) * 4;
      return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    };

    const setPixel = (x: number, y: number, color: [number, number, number, number]) => {
      const idx = (y * canvas.width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    };

    for (let iteration = 0; iteration < 50; iteration++) {
      const tempData = new Uint8ClampedArray(data);
      
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (isMasked(x, y)) {
            let r = 0, g = 0, b = 0, a = 0;
            let count = 0;

            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                  if (!isMasked(nx, ny)) {
                    const [pr, pg, pb, pa] = getPixel(nx, ny);
                    r += pr;
                    g += pg;
                    b += pb;
                    a += pa;
                    count++;
                  }
                }
              }
            }

            if (count > 0) {
              const idx = (y * canvas.width + x) * 4;
              tempData[idx] = r / count;
              tempData[idx + 1] = g / count;
              tempData[idx + 2] = b / count;
              tempData[idx + 3] = 255;
            }
          }
        }
      }

      data.set(tempData);
    }

    ctx.putImageData(imageData, 0, 0);

    maskCtx.fillStyle = "black";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    toast({
      title: "填充完成",
      description: "擦除区域已用周围颜色填充",
    });
  };

  const handleReset = () => {
    if (image && canvasRef.current && maskCanvasRef.current) {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const maskCtx = maskCanvas.getContext("2d");

      if (ctx && maskCtx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        maskCtx.fillStyle = "black";
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        toast({
          title: "已重置",
          description: "图片已恢复到原始状态",
        });
      }
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "edited-image.png";
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "下载成功",
          description: "处理后的图片已保存",
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">智能图片编辑器</h1>
          <p className="text-gray-600">上传图片，擦除不需要的区域并智能填充</p>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-center mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              上传图片
            </Button>

            {image && (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Eraser className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-600">画笔大小:</span>
                    <span className="text-sm font-semibold w-8">{brushSize}</span>
                  </div>
                  <Slider
                    value={[brushSize]}
                    onValueChange={(value) => setBrushSize(value[0])}
                    min={5}
                    max={100}
                    step={5}
                    className="w-48"
                  />
                </div>

                <Button onClick={inpaintImage} variant="default" className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Wand2 className="w-4 h-4" />
                  智能填充
                </Button>

                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  重置
                </Button>

                <Button onClick={handleDownload} variant="default" className="gap-2">
                  <Download className="w-4 h-4" />
                  下载图片
                </Button>
              </>
            )}
          </div>

          {image && (
            <div className="text-center">
              <p className="text-sm text-gray-600 bg-blue-50 inline-block px-4 py-2 rounded-lg">
                <strong>使用方法：</strong> 1. 用鼠标画出要去除的区域  2. 点击"智能填充"按钮  3. 下载处理后的图片
              </p>
            </div>
          )}
        </Card>

        {!image ? (
          <Card className="p-16 text-center border-2 border-dashed">
            <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg mb-2">点击上传图片开始</p>
            <p className="text-gray-400 text-sm">支持 JPG, PNG 等常见格式</p>
          </Card>
        ) : (
          <Card className="p-4 overflow-auto">
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="border border-gray-300 rounded-lg cursor-crosshair max-w-full h-auto shadow-lg"
                style={{ display: "block" }}
              />
              <canvas
                ref={maskCanvasRef}
                className="hidden"
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;