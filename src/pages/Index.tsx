import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Upload, Download, RotateCcw, Eraser } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
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
            description: "现在可以开始擦除图片区域",
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
        a.download = "erased-image.png";
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
          <h1 className="text-4xl font-bold text-gray-800 mb-2">图片擦除工具</h1>
          <p className="text-gray-600">上传图片并画出要去除的区域</p>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-center">
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
                className="border border-gray-300 rounded-lg cursor-crosshair max-w-full h-auto"
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