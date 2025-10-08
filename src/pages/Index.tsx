import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Upload, Download, RotateCcw, Eraser, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
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
        originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
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
    maskCtx.fillStyle = "rgba(255, 100, 100, 0.5)";
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize, 0, Math.PI * 2);
    maskCtx.fill();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (originalImageDataRef.current) {
      ctx.putImageData(originalImageDataRef.current, 0, 0);
    }
    
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "red";
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  };

  const contentAwareFill = () => {
    if (!canvasRef.current || !maskCanvasRef.current || !originalImageDataRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");

    if (!ctx || !maskCtx) return;

    toast({
      title: "正在智能填充...",
      description: "请稍候，正在分析并填充内容",
    });

    const originalData = new Uint8ClampedArray(originalImageDataRef.current.data);
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    const outputData = ctx.createImageData(canvas.width, canvas.height);
    outputData.data.set(originalData);

    const width = canvas.width;
    const height = canvas.height;

    const isMasked = (x: number, y: number): boolean => {
      const idx = (y * width + x) * 4;
      return maskData.data[idx] > 10;
    };

    const getPixel = (data: Uint8ClampedArray, x: number, y: number): [number, number, number] => {
      const idx = (y * width + x) * 4;
      return [data[idx], data[idx + 1], data[idx + 2]];
    };

    const setPixel = (data: Uint8ClampedArray, x: number, y: number, color: [number, number, number]) => {
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    };

    const getBestMatch = (x: number, y: number, patchSize: number): [number, number] | null => {
      const halfPatch = Math.floor(patchSize / 2);
      let bestX = x;
      let bestY = y;
      let bestScore = Infinity;
      const samples = 200;

      for (let i = 0; i < samples; i++) {
        const sx = Math.floor(Math.random() * width);
        const sy = Math.floor(Math.random() * height);

        if (isMasked(sx, sy)) continue;

        let validPatch = true;
        for (let dy = -halfPatch; dy <= halfPatch; dy++) {
          for (let dx = -halfPatch; dx <= halfPatch; dx++) {
            const checkX = sx + dx;
            const checkY = sy + dy;
            if (checkX < 0 || checkX >= width || checkY < 0 || checkY >= height || isMasked(checkX, checkY)) {
              validPatch = false;
              break;
            }
          }
          if (!validPatch) break;
        }

        if (!validPatch) continue;

        let score = 0;
        let count = 0;

        for (let dy = -halfPatch; dy <= halfPatch; dy++) {
          for (let dx = -halfPatch; dx <= halfPatch; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            const srcX = sx + dx;
            const srcY = sy + dy;

            if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
            if (isMasked(tx, ty)) continue;

            const [r1, g1, b1] = getPixel(outputData.data, tx, ty);
            const [r2, g2, b2] = getPixel(originalData, srcX, srcY);

            score += Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            count++;
          }
        }

        if (count > 0) {
          score /= count;
          if (score < bestScore) {
            bestScore = score;
            bestX = sx;
            bestY = sy;
          }
        }
      }

      return bestScore < Infinity ? [bestX, bestY] : null;
    };

    const boundaryPixels: Array<[number, number]> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isMasked(x, y)) {
          let isBoundary = false;
          for (let dy = -1; dy <= 1 && !isBoundary; dy++) {
            for (let dx = -1; dx <= 1 && !isBoundary; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (!isMasked(nx, ny)) {
                  isBoundary = true;
                }
              }
            }
          }
          if (isBoundary) {
            boundaryPixels.push([x, y]);
          }
        }
      }
    }

    boundaryPixels.sort(() => Math.random() - 0.5);

    const patchSize = 7;
    const halfPatch = Math.floor(patchSize / 2);
    let processed = 0;

    for (const [x, y] of boundaryPixels) {
      if (!isMasked(x, y)) continue;

      const match = getBestMatch(x, y, patchSize);
      if (match) {
        const [srcX, srcY] = match;
        const color = getPixel(originalData, srcX, srcY);
        
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && !isMasked(nx, ny)) {
              const [nr, ng, nb] = getPixel(outputData.data, nx, ny);
              r += nr;
              g += ng;
              b += nb;
              count++;
            }
          }
        }

        if (count > 0) {
          r = Math.floor((r / count + color[0]) / 2);
          g = Math.floor((g / count + color[1]) / 2);
          b = Math.floor((b / count + color[2]) / 2);
        } else {
          r = color[0];
          g = color[1];
          b = color[2];
        }

        setPixel(outputData.data, x, y, [r, g, b]);
        
        const idx = (y * width + x) * 4;
        maskData.data[idx] = 0;
      }

      processed++;
      if (processed % 100 === 0) {
        ctx.putImageData(outputData, 0, 0);
      }
    }

    for (let iteration = 0; iteration < 30; iteration++) {
      const tempData = new Uint8ClampedArray(outputData.data);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          if (maskData.data[idx] > 10) {
            let r = 0, g = 0, b = 0, count = 0;

            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const [pr, pg, pb] = getPixel(outputData.data, nx, ny);
                  const weight = (dx === 0 || dy === 0) ? 2 : 1;
                  r += pr * weight;
                  g += pg * weight;
                  b += pb * weight;
                  count += weight;
                }
              }
            }

            if (count > 0) {
              setPixel(tempData, x, y, [Math.floor(r / count), Math.floor(g / count), Math.floor(b / count)]);
            }
          }
        }
      }

      outputData.data.set(tempData);
    }

    ctx.putImageData(outputData, 0, 0);
    originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    maskCtx.fillStyle = "black";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    toast({
      title: "填充完成！",
      description: "已使用内容感知算法智能填充擦除区域",
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
        originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
        a.download = "content-aware-fill.png";
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            内容感知填充工具
          </h1>
          <p className="text-gray-600">智能识别并填充擦除区域，与周围内容完美融合</p>
        </div>

        <Card className="p-6 mb-6 shadow-lg">
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
              className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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

                <Button 
                  onClick={contentAwareFill} 
                  variant="default" 
                  className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Wand2 className="w-4 h-4" />
                  内容感知填充
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
              <div className="inline-flex flex-col gap-2 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-3 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>📝 使用方法：</strong>
                </p>
                <p className="text-xs text-gray-600">
                  1️⃣ 用鼠标涂抹标记要去除的区域（红色半透明显示）
                </p>
                <p className="text-xs text-gray-600">
                  2️⃣ 点击"内容感知填充"按钮，AI会自动分析并填充
                </p>
                <p className="text-xs text-gray-600">
                  3️⃣ 满意后点击下载保存处理后的图片
                </p>
              </div>
            </div>
          )}
        </Card>

        {!image ? (
          <Card className="p-16 text-center border-2 border-dashed shadow-lg">
            <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg mb-2">点击上传图片开始</p>
            <p className="text-gray-400 text-sm">支持 JPG, PNG 等常见格式</p>
          </Card>
        ) : (
          <Card className="p-4 overflow-auto shadow-lg">
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="border-2 border-gray-300 rounded-lg cursor-crosshair max-w-full h-auto shadow-xl"
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