d3.egoNetworks = function module() {
  var attrs = {
    width: 400,
    height:400,
    egoIndex:0,
    degreeMin:1,
    degreeMax:10
  }
  var margin = {top:10, right:10, bottom:10, left:10}
  var size = d3.scale.linear();
  var innerWidth, innerHeight, netRadius;
  var svg;

  var exports = function (_selection) {
    _selection.each(function(_data) {
      if(!svg) {
        d3.select(this).style('width', attrs.width + 'px')
          .style('height', attrs.height + 'px')
        innerWidth = attrs.width - margin.left - margin.right;
        innerHeight = attrs.height - margin.top - margin.bottom;
        netRadius = innerWidth*.4;
        svg = d3.select(this).append('svg')
          .attr('width', attrs.width)
          .attr('height', attrs.height)
          .append('g')
          .attr('transform', d3.svg.transform().translate([margin.left, margin.top]))
      }
      size.domain([attrs.degreeMin,attrs.degreeMax])
        .rangeRound([innerWidth*.02, innerWidth*.15]);
      svg.datum(_data)
        .call(egoInit)
    })
  }

  function egoInit(_selection) {
    _selection.each(function(_data) {
      var egoData = getCurEgo(_data.nodes),
      neighborsData = getNeighbors(_data);
      egoData.egoIndex = attrs.egoIndex;
      egoData.egoDegree = neighborsData.reduce(function(pre, cur){
        return pre + cur.linkToEgo.value
      },0)
      //setLinkToNeighbors(neighborsData, _data.links)
      var selection = d3.select(this);
      var thetaUnit = Math.PI*2 / neighborsData.length,
        thetaOffset = thetaUnit *.3

      selection.append('circle')
        .attr('class', 'background')
        .attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
        .attr('r', netRadius)

      var ego = selection.selectAll('.ego')
        .data([egoData], function(d){return attrs.egoIndex})

      ego.enter().append('g')
        .attr('class', 'ego node')
        .append('circle')

      ego.attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
        .selectAll('circle')
        .attr('r', function(d){return size(d.egoDegree)})

      ego.exit()
        .classed({'ego':false, 'neighbor':true})

      var neighborFunc = function(selection, neighbors, callback) {
        selection.each(function(d) {
          if ('linkToNeighbors' in d) {
            d.linkToNeighbors.forEach(function(l) {
              neighbors.filter(function(n) {
                return ((l.source == n.neighborIndex || l.target == n.neighborIndex)
                  && n.neighborIndex !== d.neighborIndex)
              }).each(callback)
            })
          }
        })
      }

      var neighbors = selection.selectAll('.neighbor')
        .data(neighborsData, function(d){return d.neighborIndex})

      neighbors.enter().append('g')
        .attr('class', 'neighbor node new')
      selection.selectAll('.neighbor.new')
        .append('circle')
      selection.selectAll('.neighbor.new')
        .append('text')
      selection.selectAll('.neighbor.new')
        .classed({'new':false})

      neighbors.each(function(d,i) {
        d.theta = thetaUnit*i;
        d.linkToNeighbors = []
        neighbors.each(function(n,j) {
          if (j>i) {
            var filtered = _data.links.filter(function(l) {
              return (l.source === d.neighborIndex && l.target === n.neighborIndex)
                || (l.target === d.neighborIndex && l.source === n.neighborIndex)
            })
            d.linkToNeighbors = d.linkToNeighbors.concat(filtered); // 한쪽에만 링크를 두어서 루프 최소화
          }
        })
      }).attr('transform', d3.svg.transform().translate(function(d,i) {
        d3.select(this).call(neighborFunc, neighbors, function(n) {
              if(n.theta - d.theta <= Math.PI) {
                //FIXME : 링크 value를 곱해주기
                d.theta += thetaOffset;
                n.theta -= thetaOffset;
              } else {
                d.theta -= thetaOffset;
                n.theta += thetaOffset;
              }
          });
          d.x = innerWidth*.5+Math.cos(d.theta)*netRadius;
          d.y = innerHeight*.5+Math.sin(d.theta)*netRadius;
          return [d.x, d.y]
        }))

      neighbors.selectAll('circle')
        .attr('r', function(d){return size(d.linkToEgo.value)})

      neighbors.selectAll('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(function(d) {return d.neighborIndex})

      var two_pi = Math.PI*2, half_pi = Math.PI*.5;
      var linkRadius = d3.scale.linear()
        .domain([0, half_pi])
        .range([netRadius*.5, netRadius])

      var linkLine = d3.svg.line()
        .interpolate('cardinal')
        .tension(0)
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; });

      neighbors.each(function(d){
        var self = d3.select(this);
        self.call(neighborFunc, neighbors, function(n) {
          // d-n
          var distTheta = (Math.abs(n.theta-d.theta)%(two_pi));
          //console.log(d.neighborIndex, n.neighborIndex, distTheta);
          if (distTheta <= half_pi) {
            var meanTheta = distTheta*.5 + d.theta;
            var r = linkRadius(meanTheta%Math.PI);
            var center = {x: Math.cos(meanTheta)*r + innerWidth*.5
              , y: Math.sin(meanTheta)*r + innerHeight*.5}
            selection.append('path')
              .datum([{x:d.x, y:d.y}, center, {x:n.x, y:n.y}])
              .attr('class', 'link')
              .attr('d', linkLine)
            selection.append('circle')
              .datum(center)
              .attr('cx', function(d){return d.x})
              .attr('cy', function(d){return d.y})
              .attr('r', 2)
          } else {
            selection.append('path')
              .datum([{x:d.x, y:d.y}, {x:n.x, y:n.y}])
              .attr('class', 'link')
              .attr('d', linkLine)
              //.attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
          }
          //console.log(distTheta);
        });
      })

      /*
      ego.attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeigh/2]))
        .attr('r', )
      */

      /*
      TODO
        [x] 1. neighbors 구하기
        2. ego의 degree 값 구하기
        3. neighbor들을 그룹 key 가 있다면 함께 묶어주기 => nested
        3. ego와 neighbor 그리기 (절대값은?)
        4. (옵션) distant 2 까지 그리기?
        5. (옵션) 연도와 같이 정렬이나 분류 가능한 기준이 있다면 해당 값에 따라 ego와의 거리를 조절?
        5. 이웃 node 클릭시 새롭게 이동? -> 1로 다시
      */
    })
  }

  function getNeighbors(_data) {
    var neighbors = []
    _data.links.forEach(function(l,i) {
      if (attrs.egoIndex === l.source) {
        neighbors.push({neighbor:_data.nodes[l.target], linkToEgo:l, neighborIndex:l.target})
      } else if (attrs.egoIndex === l.target) {
        neighbors.push({neighbor:_data.nodes[l.source], linkToEgo:l, neighborIndex:l.source})
      }
    })
    return neighbors;
  }

  function getCurEgo(nodes) {
    return nodes[attrs.egoIndex]
  }

  function accessor(_attr) {
    return function(value) {
      if(value === undefined) return attrs[_attr]
      attrs[_attr] = value;
      return exports;
    }
  }

  for (var attr in attrs) {
    if(attrs.hasOwnProperty(attr)) {
      exports[attr] = accessor(attr);
    }
  }

  return exports;
}
